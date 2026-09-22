from django.utils import timezone

class ActiveUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            # Update last_seen every 60 seconds at most to reduce excessive DB writes
            now = timezone.now()
            profile = getattr(request.user, 'profile', None)
            if profile:
                if (now - profile.last_seen).total_seconds() > 60:
                    profile.last_seen = now
                    profile.save(update_fields=['last_seen'])
        return self.get_response(request)
