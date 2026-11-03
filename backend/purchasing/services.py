from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import User

from .models import Budget, Event, Purchase, Quote, Requisition, RequisitionItem
from .permissions import require_approver, require_author, require_role


def record(requisition, actor, action, comment=""):
    Event.objects.create(requisition=requisition, actor=actor, action=action, comment=comment)


def ensure_status(requisition, *statuses):
    if requisition.status not in statuses:
        raise ValidationError("Действие недоступно в текущем статусе заявки.")


def locked_requisition(pk):
    return Requisition.objects.select_for_update().get(pk=pk)


def editable(requisition):
    ensure_status(requisition, Requisition.Status.DRAFT, Requisition.Status.RETURNED)


@transaction.atomic
def save_requisition(actor, data, instance=None):
    items = data.pop("items")
    if instance:
        instance = locked_requisition(instance.pk)
        require_author(actor, instance)
        editable(instance)
        for key, value in data.items():
            setattr(instance, key, value)
        instance.save()
        instance.items.all().delete()
    else:
        instance = Requisition.objects.create(author=actor, **data)
    RequisitionItem.objects.bulk_create(
        [RequisitionItem(requisition=instance, **item) for item in items]
    )
    record(instance, actor, "Заявка обновлена" if instance.events.exists() else "Заявка создана")
    return instance


@transaction.atomic
def submit(pk, actor):
    req = locked_requisition(pk)
    require_author(actor, req)
    editable(req)
    if not req.items.exists():
        raise ValidationError("Добавьте хотя бы одну позицию.")
    if req.needed_by < timezone.localdate():
        raise ValidationError("Срок закупки уже прошёл. Обновите дату.")
    req.status = Requisition.Status.PENDING
    req.save(update_fields=["status", "updated_at"])
    record(req, actor, "Заявка отправлена на согласование")
    return req


@transaction.atomic
def decide(pk, actor, decision, comment=""):
    req = locked_requisition(pk)
    require_approver(actor, req)
    ensure_status(req, Requisition.Status.PENDING)
    if decision == "approve":
        month = timezone.localdate().replace(day=1)
        try:
            budget = Budget.objects.select_for_update().get(department=req.department, month=month)
        except Budget.DoesNotExist as exc:
            raise ValidationError("Для отдела не настроен бюджет на текущий месяц.") from exc
        amount = req.total
        if amount > budget.available:
            raise ValidationError("Недостаточно свободных средств в бюджете отдела.")
        budget.reserved += amount
        budget.save(update_fields=["reserved"])
        req.budget = budget
        req.approved_amount = amount
        req.status = Requisition.Status.APPROVED
        label = "Заявка согласована"
    else:
        if not comment.strip():
            raise ValidationError("Укажите причину решения.")
        req.status = (
            Requisition.Status.RETURNED if decision == "return" else Requisition.Status.REJECTED
        )
        label = "Заявка возвращена на доработку" if decision == "return" else "Заявка отклонена"
    req.save()
    record(req, actor, label, comment)
    return req


@transaction.atomic
def cancel(pk, actor):
    req = locked_requisition(pk)
    if actor.pk != req.author_id:
        require_role(actor, User.Role.ADMIN, User.Role.BUYER)
    ensure_status(
        req,
        Requisition.Status.DRAFT,
        Requisition.Status.RETURNED,
        Requisition.Status.PENDING,
        Requisition.Status.APPROVED,
    )
    if req.status == Requisition.Status.APPROVED:
        budget = Budget.objects.select_for_update().get(pk=req.budget_id)
        budget.reserved -= req.approved_amount
        budget.save(update_fields=["reserved"])
    req.status = Requisition.Status.CANCELLED
    req.save(update_fields=["status", "updated_at"])
    record(req, actor, "Заявка отменена")
    return req


@transaction.atomic
def add_quote(pk, actor, data):
    require_role(actor, User.Role.BUYER, User.Role.ADMIN)
    req = locked_requisition(pk)
    ensure_status(req, Requisition.Status.APPROVED)
    if Quote.objects.filter(requisition=req, supplier=data["supplier"]).exists():
        raise ValidationError("Предложение этого поставщика уже добавлено.")
    quote = Quote.objects.create(requisition=req, **data)
    record(req, actor, "Добавлено предложение поставщика", quote.supplier.name)
    return quote


@transaction.atomic
def order(pk, actor, quote_id, expected_on):
    require_role(actor, User.Role.BUYER, User.Role.ADMIN)
    req = locked_requisition(pk)
    ensure_status(req, Requisition.Status.APPROVED)
    try:
        quote = req.quotes.get(pk=quote_id)
    except Quote.DoesNotExist as exc:
        raise ValidationError("Предложение не относится к этой заявке.") from exc
    if quote.amount > req.approved_amount:
        raise ValidationError(
            "Цена превышает согласованную сумму. Создайте новую заявку с актуальным расчётом."
        )
    if expected_on < timezone.localdate():
        raise ValidationError("Дата поставки не может быть в прошлом.")
    budget = Budget.objects.select_for_update().get(pk=req.budget_id)
    budget.reserved -= req.approved_amount
    budget.spent += quote.amount
    budget.save(update_fields=["reserved", "spent"])
    Purchase.objects.create(
        requisition=req, quote=quote, amount=quote.amount, ordered_by=actor, expected_on=expected_on
    )
    req.status = Requisition.Status.ORDERED
    req.save(update_fields=["status", "updated_at"])
    record(req, actor, "Закупка оформлена", f"{quote.supplier.name} · {quote.amount} ₽")
    return req


@transaction.atomic
def receive(pk, actor, items):
    req = locked_requisition(pk)
    if actor.pk != req.author_id:
        require_role(actor, User.Role.BUYER, User.Role.ADMIN)
    ensure_status(req, Requisition.Status.ORDERED)
    existing = {item.pk: item for item in req.items.select_for_update()}
    ids = [item["id"] for item in items]
    if len(ids) != len(set(ids)):
        raise ValidationError("Позиции приёмки не должны повторяться.")
    for item in items:
        original = existing.get(item["id"])
        if original is None or original.received_quantity + item["quantity"] > original.quantity:
            raise ValidationError("Проверьте позиции и количество полученного товара.")
        original.received_quantity += item["quantity"]
        original.save(update_fields=["received_quantity"])
    if all(item.received_quantity == item.quantity for item in existing.values()):
        req.status = Requisition.Status.RECEIVED
        req.save(update_fields=["status", "updated_at"])
    record(
        req,
        actor,
        "Товары получены"
        if req.status == Requisition.Status.RECEIVED
        else "Часть товаров получена",
    )
    return req


@transaction.atomic
def set_budget(actor, data):
    require_role(actor, User.Role.ADMIN)
    budget = (
        Budget.objects.select_for_update()
        .filter(department=data["department"], month=data["month"])
        .first()
    )
    if budget:
        if data["limit"] < budget.spent + budget.reserved:
            raise ValidationError("Лимит не может быть меньше расходов и резервов.")
        budget.limit = data["limit"]
        budget.save(update_fields=["limit"])
        return budget
    return Budget.objects.create(**data, spent=Decimal("0"), reserved=Decimal("0"))
