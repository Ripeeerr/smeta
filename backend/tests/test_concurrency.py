from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from django.db import close_old_connections, connections
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from purchasing import services
from purchasing.models import Budget


@pytest.mark.django_db(transaction=True)
def test_simultaneous_approvals_cannot_spend_same_remaining_budget(workspace):
    w = workspace
    requests = []
    for index in range(2):
        req = services.save_requisition(
            w["employee"],
            {
                "title": f"Параллельная заявка {index}",
                "description": "Проверка одновременного согласования",
                "department": w["sales"],
                "needed_by": timezone.localdate(),
                "items": [{"name": "Товар", "quantity": 1, "unit_price": Decimal("700")}],
            },
        )
        services.submit(req.pk, w["employee"])
        requests.append(req.pk)

    def approve(pk):
        close_old_connections()
        try:
            services.decide(pk, w["manager"], "approve")
            return "approved"
        except ValidationError:
            return "insufficient"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(approve, requests))
    assert sorted(results) == ["approved", "insufficient"]
    w["budget"].refresh_from_db()
    assert w["budget"].reserved == 700
    assert w["budget"].available == 300


@pytest.mark.django_db(transaction=True)
def test_simultaneous_budget_creation_is_serialized(workspace):
    w = workspace
    month = w["budget"].month

    def create(limit):
        close_old_connections()
        try:
            return services.set_budget(
                w["admin"], {"department": w["other"], "month": month, "limit": Decimal(limit)}
            ).pk
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        ids = list(executor.map(create, ["1000", "2000"]))
    assert ids[0] == ids[1]
    assert Budget.objects.filter(department=w["other"], month=month).count() == 1


@pytest.mark.django_db(transaction=True)
def test_simultaneous_uploads_cannot_exceed_attachment_count(workspace, settings, tmp_path):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from tests.test_workflow import draft

    settings.MEDIA_ROOT = tmp_path
    req = draft(workspace)
    for index in range(4):
        services.add_attachment(
            req.pk, workspace["employee"], SimpleUploadedFile(f"file-{index}.pdf", b"%PDF-1.4 test")
        )

    def upload(index):
        close_old_connections()
        try:
            services.add_attachment(
                req.pk,
                workspace["employee"],
                SimpleUploadedFile(f"upload-{index}.pdf", b"%PDF-1.4 test"),
            )
            return "created"
        except ValidationError:
            return "limit"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(upload, [1, 2]))
    assert sorted(results) == ["created", "limit"]
    assert req.attachments.count() == 5
