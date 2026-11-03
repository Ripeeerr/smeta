from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from purchasing import services
from purchasing.models import Requisition


def draft(w, amount="600", actor="employee"):
    return services.save_requisition(
        w[actor],
        {
            "title": "Тестовая закупка",
            "description": "Оборудование для рабочих мест",
            "department": w["sales"],
            "needed_by": timezone.localdate(),
            "items": [{"name": "Монитор", "quantity": 2, "unit_price": Decimal(amount) / 2}],
        },
    )


def approved(w, amount="600"):
    req = draft(w, amount)
    services.submit(req.pk, w["employee"])
    return services.decide(req.pk, w["manager"], "approve")


def ordered(w):
    req = approved(w)
    quote = services.add_quote(
        req.pk,
        w["buyer"],
        {"supplier": w["supplier"], "amount": Decimal("550"), "delivery_days": 3},
    )
    return services.order(req.pk, w["buyer"], quote.pk, timezone.localdate())


def test_approval_reserves_and_cancel_releases(workspace):
    w = workspace
    req = approved(w)
    w["budget"].refresh_from_db()
    assert w["budget"].reserved == Decimal("600")
    services.cancel(req.pk, w["employee"])
    w["budget"].refresh_from_db()
    assert w["budget"].reserved == 0
    assert w["budget"].available == 1000


def test_insufficient_budget_does_not_change_either_request(workspace):
    w = workspace
    approved(w, "700")
    second = draft(w, "400")
    services.submit(second.pk, w["employee"])
    with pytest.raises(ValidationError):
        services.decide(second.pk, w["manager"], "approve")
    w["budget"].refresh_from_db()
    second.refresh_from_db()
    assert w["budget"].reserved == 700
    assert second.status == "pending"


def test_order_uses_actual_price_and_releases_difference(workspace):
    req = ordered(workspace)
    workspace["budget"].refresh_from_db()
    assert workspace["budget"].reserved == 0
    assert workspace["budget"].spent == 550
    assert workspace["budget"].available == 450
    assert req.status == "ordered"


def test_partial_receipt_and_over_receipt_are_atomic(workspace):
    req = ordered(workspace)
    item = req.items.get()
    services.receive(req.pk, workspace["employee"], [{"id": item.pk, "quantity": 1}])
    with pytest.raises(ValidationError):
        services.receive(req.pk, workspace["employee"], [{"id": item.pk, "quantity": 2}])
    item.refresh_from_db()
    assert item.received_quantity == 1
    result = services.receive(req.pk, workspace["buyer"], [{"id": item.pk, "quantity": 1}])
    assert result.status == "received"


def test_duplicate_actions_never_double_reserve(workspace):
    req = approved(workspace)
    with pytest.raises(ValidationError):
        services.decide(req.pk, workspace["manager"], "approve")
    workspace["budget"].refresh_from_db()
    assert workspace["budget"].reserved == 600


def test_cannot_approve_own_request(workspace):
    req = draft(workspace, actor="manager")
    services.submit(req.pk, workspace["manager"])
    with pytest.raises(PermissionDenied):
        services.decide(req.pk, workspace["manager"], "approve")


def test_employee_cannot_order_or_create_quotes(workspace):
    req = approved(workspace)
    with pytest.raises(PermissionDenied):
        services.add_quote(req.pk, workspace["employee"], {})


def test_price_above_approval_does_not_consume_budget(workspace):
    req = approved(workspace)
    quote = services.add_quote(
        req.pk,
        workspace["buyer"],
        {"supplier": workspace["supplier"], "amount": Decimal("650"), "delivery_days": 3},
    )
    with pytest.raises(ValidationError):
        services.order(req.pk, workspace["buyer"], quote.pk, timezone.localdate())
    workspace["budget"].refresh_from_db()
    assert workspace["budget"].spent == 0
    assert workspace["budget"].reserved == 600


def test_budget_cannot_be_reduced_below_reserved(workspace):
    approved(workspace)
    with pytest.raises(ValidationError):
        services.set_budget(
            workspace["admin"],
            {
                "department": workspace["sales"],
                "month": workspace["budget"].month,
                "limit": Decimal("599"),
            },
        )


def test_return_requires_comment_and_allows_editing(workspace):
    req = draft(workspace)
    services.submit(req.pk, workspace["employee"])
    with pytest.raises(ValidationError):
        services.decide(req.pk, workspace["manager"], "return")
    req = services.decide(req.pk, workspace["manager"], "return", "Уточните требования")
    assert req.status == Requisition.Status.RETURNED
    assert req.events.first().comment == "Уточните требования"


def test_private_requests_are_inaccessible(workspace, client):
    req = draft(workspace)
    client.force_authenticate(workspace["outsider"])
    assert client.get(f"/api/requisitions/{req.pk}/").status_code == 404
    assert client.get("/api/requisitions/").json() == []


def test_employee_cannot_spoof_department_or_status(workspace, client):
    client.force_authenticate(workspace["employee"])
    payload = {
        "title": "Покупка",
        "description": "Для отдела",
        "department": workspace["other"].pk,
        "needed_by": str(timezone.localdate()),
        "status": "approved",
        "items": [{"name": "Товар", "quantity": 1, "unit_price": "10"}],
    }
    assert client.post("/api/requisitions/", payload).status_code == 400
    payload["department"] = workspace["sales"].pk
    response = client.post("/api/requisitions/", payload)
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


def test_login_and_logout_require_csrf(workspace):
    from rest_framework.test import APIClient

    client = APIClient(enforce_csrf_checks=True)
    assert (
        client.post(
            "/api/auth/login/", {"username": "employee", "password": "test-only-password"}
        ).status_code
        == 403
    )
    token = client.get("/api/auth/session/").json()["csrf_token"]
    result = client.post(
        "/api/auth/login/",
        {"username": "employee", "password": "test-only-password"},
        HTTP_X_CSRFTOKEN=token,
    )
    assert result.status_code == 200
    assert client.post("/api/auth/logout/").status_code == 403
    assert (
        client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=result.json()["csrf_token"]).status_code
        == 200
    )
    assert client.get("/api/auth/session/").json()["user"] is None


def test_files_are_private_downloads(workspace, client, tmp_path, settings):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    req = draft(workspace)
    client.force_authenticate(workspace["employee"])
    response = client.post(
        f"/api/requisitions/{req.pk}/attachments/",
        {"file": SimpleUploadedFile("document.pdf", b"%PDF-1.4 demo")},
        format="multipart",
    )
    assert response.status_code == 201
    url = f"/api/attachments/{response.json()['id']}/"
    client.force_authenticate(workspace["outsider"])
    assert client.get(url).status_code == 403
    client.force_authenticate(workspace["employee"])
    result = client.get(url)
    assert result.status_code == 200
    assert result["Content-Type"] == "application/octet-stream"
    assert "attachment" in result["Content-Disposition"]


def test_invalid_month_is_validation_error(workspace, client):
    client.force_authenticate(workspace["employee"])
    assert client.get("/api/overview/?month=invalid").status_code == 400
