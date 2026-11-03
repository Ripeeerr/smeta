from rest_framework.exceptions import PermissionDenied

from accounts.models import User


def visible_requisitions(user, queryset):
    if user.role in (User.Role.ADMIN, User.Role.BUYER):
        return queryset
    if user.role == User.Role.MANAGER:
        return queryset.filter(department_id=user.department_id)
    return queryset.filter(author=user)


def require_role(user, *roles):
    if user.role not in roles:
        raise PermissionDenied("Недостаточно прав для этого действия.")


def require_author(user, requisition):
    if requisition.author_id != user.pk:
        raise PermissionDenied("Изменять заявку может только её автор.")


def require_approver(user, requisition):
    require_role(user, User.Role.ADMIN, User.Role.MANAGER)
    if requisition.author_id == user.pk:
        raise PermissionDenied("Нельзя согласовать собственную заявку.")
    if user.role == User.Role.MANAGER and user.department_id != requisition.department_id:
        raise PermissionDenied("Заявка относится к другому отделу.")
