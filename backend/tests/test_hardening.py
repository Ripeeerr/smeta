from io import StringIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from purchasing.models import Attachment, Requisition
from purchasing.uploads import LimitedFileUploadHandler
from tests.test_workflow import draft


def test_demo_director_name_is_updated_from_environment_without_reset(
    workspace, settings, monkeypatch
):
    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", "a-different-demo-password")
    monkeypatch.setenv("DEMO_DIRECTOR_FIRST_NAME", "Виктор")
    monkeypatch.setenv("DEMO_DIRECTOR_LAST_NAME", "Меньшин")
    before = Requisition.objects.count()
    call_command("seed_demo", stdout=StringIO())
    user = workspace["admin"]
    user.refresh_from_db()
    assert user.display_name == "Виктор Меньшин"
    assert user.check_password("test-only-password")
    assert Requisition.objects.count() == before


def test_demo_director_name_is_required(workspace, settings, monkeypatch):
    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", "a-valid-demo-password")
    monkeypatch.setenv("DEMO_DIRECTOR_FIRST_NAME", "")
    with pytest.raises(CommandError):
        call_command("seed_demo", stdout=StringIO())


def test_new_demo_profile_uses_environment_name(db, settings, monkeypatch):
    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", "a-valid-demo-password")
    monkeypatch.setenv("DEMO_DIRECTOR_FIRST_NAME", "Имя")
    monkeypatch.setenv("DEMO_DIRECTOR_LAST_NAME", "Руководителя")
    call_command("seed_demo", stdout=StringIO())
    assert User.objects.get(username="director").display_name == "Имя Руководителя"


def test_upload_rejects_html_disguised_as_pdf(workspace, client, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    req = draft(workspace)
    client.force_authenticate(workspace["employee"])
    file = SimpleUploadedFile("invoice.pdf", b"<script>alert(document.cookie)</script>")
    result = client.post(
        f"/api/requisitions/{req.pk}/attachments/", {"file": file}, format="multipart"
    )
    assert result.status_code == 400
    assert not Attachment.objects.exists()


def test_upload_size_limit_is_enforced_during_streaming(
    workspace, client, monkeypatch, settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path
    monkeypatch.setattr(LimitedFileUploadHandler, "max_file_size", 32)
    req = draft(workspace)
    client.force_authenticate(workspace["employee"])
    file = SimpleUploadedFile("invoice.pdf", b"%PDF-1.4" + b"a" * 100)
    result = client.post(
        f"/api/requisitions/{req.pk}/attachments/", {"file": file}, format="multipart"
    )
    assert result.status_code == 400
    assert not Attachment.objects.exists()


def test_oversized_json_is_rejected_before_parsing(workspace, client, settings):
    settings.DATA_UPLOAD_MAX_MEMORY_SIZE = 32
    client.force_authenticate(workspace["employee"])
    result = client.post("/api/requisitions/", {"title": "a" * 200})
    assert result.status_code == 400
    assert not Requisition.objects.exists()


def test_cross_department_manager_cannot_approve(workspace, client):
    req = draft(workspace)
    manager = workspace["manager"]
    manager.department = workspace["other"]
    manager.save(update_fields=["department"])
    client.force_authenticate(manager)
    result = client.post(f"/api/requisitions/{req.pk}/decision/", {"decision": "approve"})
    assert result.status_code == 404


def test_employee_cannot_set_budget_or_modify_suppliers(workspace, client):
    client.force_authenticate(workspace["employee"])
    result = client.post(
        "/api/budgets/",
        {
            "department": workspace["sales"].pk,
            "month": str(workspace["budget"].month),
            "limit": "9999",
        },
    )
    assert result.status_code == 403
    payload = {"name": "Изменённый поставщик", "tax_id": "7701234567"}
    assert client.put(f"/api/suppliers/{workspace['supplier'].pk}/", payload).status_code == 403


def test_private_api_responses_cannot_be_cached(workspace, client):
    client.force_authenticate(workspace["employee"])
    for url in ("/api/auth/session/", "/api/overview/", "/api/requisitions/"):
        response = client.get(url)
        assert response["Cache-Control"] == "private, no-store"
