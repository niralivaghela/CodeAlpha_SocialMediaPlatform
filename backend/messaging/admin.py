from django.contrib import admin
from .models import Conversation, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user1', 'user2', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender', 'text_snippet', 'is_read', 'created_at')
    list_filter = ('is_read',)

    def text_snippet(self, obj):
        return obj.text[:40] + '...' if len(obj.text) > 40 else obj.text
