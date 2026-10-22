from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from django.db import close_old_connections
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from purchasing import services


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
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(approve, requests))
    assert sorted(results) == ["approved", "insufficient"]
    w["budget"].refresh_from_db()
    assert w["budget"].reserved == 700
    assert w["budget"].available == 300
