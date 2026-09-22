from django.contrib import admin
from .models import Profile

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'location', 'is_private', 'is_online', 'last_seen', 'created_at')
    search_fields = ('user__username', 'user__email', 'bio', 'location')
    list_filter = ('is_private',)
