from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Department, User

admin.site.register(Department)


@admin.register(User)
class SmetaUserAdmin(UserAdmin):
    fieldsets = (*UserAdmin.fieldsets, ("Рабочее пространство", {"fields": ("role", "department")}))
