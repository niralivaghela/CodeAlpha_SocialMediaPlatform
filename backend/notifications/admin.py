from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'recipient', 'actor', 'action_type', 'is_read', 'created_at')
    list_filter = ('action_type', 'is_read')
