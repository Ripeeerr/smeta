from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        EMPLOYEE = "employee", "Сотрудник"
        MANAGER = "manager", "Руководитель отдела"
        BUYER = "buyer", "Закупщик"
        ADMIN = "admin", "Руководитель компании"

    role = models.CharField(max_length=12, choices=Role.choices, default=Role.EMPLOYEE)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True)

    @property
    def display_name(self):
        return self.get_full_name() or self.username
