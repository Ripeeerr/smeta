from django.contrib import admin

from .models import Budget, Event, Requisition, Supplier

admin.site.register(Supplier)


@admin.register(Budget, Requisition, Event)
class ReadOnlyBusinessAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
