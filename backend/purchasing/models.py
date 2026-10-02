import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from accounts.models import Department


class Budget(models.Model):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="budgets")
    month = models.DateField()
    limit = models.DecimalField(max_digits=14, decimal_places=2)
    reserved = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    spent = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["department__name"]
        constraints = [
            models.UniqueConstraint(fields=["department", "month"], name="unique_department_month"),
            models.CheckConstraint(
                condition=Q(limit__gte=0, reserved__gte=0, spent__gte=0), name="nonnegative_budget"
            ),
            models.CheckConstraint(
                condition=Q(limit__gte=F("spent") + F("reserved")), name="budget_within_limit"
            ),
        ]

    @property
    def available(self):
        return self.limit - self.spent - self.reserved


class Supplier(models.Model):
    name = models.CharField(max_length=160)
    tax_id = models.CharField(max_length=12, unique=True)
    contact = models.CharField(max_length=160, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(max_length=2000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Requisition(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        PENDING = "pending", "На согласовании"
        RETURNED = "returned", "На доработке"
        APPROVED = "approved", "К закупке"
        ORDERED = "ordered", "В пути"
        RECEIVED = "received", "Получено"
        REJECTED = "rejected", "Отклонено"
        CANCELLED = "cancelled", "Отменено"

    title = models.CharField(max_length=180)
    description = models.TextField(max_length=4000)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requisitions"
    )
    department = models.ForeignKey(Department, on_delete=models.PROTECT)
    budget = models.ForeignKey(Budget, on_delete=models.PROTECT, null=True, blank=True)
    needed_by = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    approved_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["department", "status"]),
            models.Index(fields=["needed_by"]),
        ]

    @property
    def number(self):
        return f"ЗК-{self.pk:04d}"

    @property
    def total(self):
        return sum((item.total for item in self.items.all()), Decimal("0.00"))


class RequisitionItem(models.Model):
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=180)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    received_quantity = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0, unit_price__gt=0), name="positive_item_values"
            ),
            models.CheckConstraint(
                condition=Q(received_quantity__lte=F("quantity")), name="received_within_quantity"
            ),
        ]

    @property
    def total(self):
        return self.quantity * self.unit_price


class Quote(models.Model):
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name="quotes")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    delivery_days = models.PositiveSmallIntegerField()
    notes = models.TextField(max_length=2000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["amount", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0, delivery_days__gt=0), name="positive_quote_values"
            ),
            models.UniqueConstraint(
                fields=["requisition", "supplier"], name="unique_supplier_quote"
            ),
        ]


class Purchase(models.Model):
    requisition = models.OneToOneField(
        Requisition, on_delete=models.PROTECT, related_name="purchase"
    )
    quote = models.ForeignKey(Quote, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    expected_on = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)


class Event(models.Model):
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=160)
    comment = models.TextField(max_length=2000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


def attachment_path(instance, filename):
    return f"{instance.requisition_id}/{uuid.uuid4().hex}"


class Attachment(models.Model):
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name="attachments"
    )
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    original_name = models.CharField(max_length=180)
    file = models.FileField(upload_to=attachment_path)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
