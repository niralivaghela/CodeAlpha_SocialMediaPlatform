import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Count, Q, Case, When, Value, BooleanField
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from accounts.models import Profile
from posts.models import (
    Post, Hashtag, Poll, PollOption, PollVote, Like, Bookmark, Story,
    Reaction, PostDraft, BookmarkCollection, BookmarkCollectionItem,
    StoryView, StoryHighlight
)
from comments.models import Comment, CommentLike
from social.models import Follow, Block, Report, FollowRequest, Mute, HiddenPost
from notifications.models import Notification
from messaging.models import Conversation, Message, MessageReaction

from .serializers import (
    UserMinimalSerializer, ProfileSerializer, PostSerializer,
    CommentSerializer, NotificationSerializer, ConversationSerializer,
    MessageSerializer, HashtagSerializer, PollSerializer, StorySerializer,
    PostDraftSerializer, BookmarkCollectionSerializer, StoryHighlightSerializer,
    FollowRequestSerializer, ReportAdminSerializer
)

# -------------------------------------------------------------
# HELPERS: Blocked, Muted, and Hidden IDs for current user
# -------------------------------------------------------------
def get_blocked_user_ids(user):
    if not user.is_authenticated:
        return []
    blocked_by_me = Block.objects.filter(blocker=user).values_list('blocked_id', flat=True)
    blocking_me = Block.objects.filter(blocked=user).values_list('blocker_id', flat=True)
    return list(set(list(blocked_by_me) + list(blocking_me)))

def get_muted_user_ids(user):
    if not user.is_authenticated:
        return []
    return list(Mute.objects.filter(muter=user).values_list('muted_id', flat=True))

def get_hidden_post_ids(user):
    if not user.is_authenticated:
        return []
    return list(HiddenPost.objects.filter(user=user).values_list('post_id', flat=True))

# -------------------------------------------------------------
# AUTHENTICATION VIEWS
# -------------------------------------------------------------
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        full_name = request.data.get('full_name', '').strip()
        username = request.data.get('username', '').strip().lower()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        confirm_password = request.data.get('confirm_password', '')

        errors = {}
        if not full_name:
            errors['full_name'] = 'Full name is required.'
        if not username:
            errors['username'] = 'Username is required.'
        elif len(username) < 3:
            errors['username'] = 'Username must be at least 3 characters.'
        elif not username.isalnum() and '_' not in username:
            errors['username'] = 'Username may only contain letters, numbers, and underscores.'
        elif User.objects.filter(username__iexact=username).exists():
            errors['username'] = 'This username is already taken.'

        if not email:
            errors['email'] = 'Email is required.'
        elif User.objects.filter(email__iexact=email).exists():
            errors['email'] = 'This email is already registered.'

        if not password:
            errors['password'] = 'Password is required.'
        elif len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters long.'

        if password != confirm_password:
            errors['confirm_password'] = 'Passwords do not match.'

        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        # Split full name into first and last name
        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        # Log the user in via session
        login(request, user)

        serializer = ProfileSerializer(user.profile, context={'request': request})
        return Response({
            'message': 'Account created successfully.',
            'user': serializer.data
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not identifier or not password:
            return Response(
                {'error': 'Invalid username or password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Allow login via username or email
        user = None
        if '@' in identifier:
            user_obj = User.objects.filter(email__iexact=identifier).first()
            if user_obj:
                user = authenticate(request, username=user_obj.username, password=password)
        else:
            user = authenticate(request, username=identifier, password=password)

        if user is not None:
            login(request, user)
            # Update last_seen
            if hasattr(user, 'profile'):
                user.profile.last_seen = timezone.now()
                user.profile.save(update_fields=['last_seen'])
            serializer = ProfileSerializer(user.profile, context={'request': request})
            return Response({
                'message': 'Login successful.',
                'user': serializer.data
            })
        else:
            return Response(
                {'error': 'Invalid username or password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out successfully.'})

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not request.user.check_password(current_password):
            return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'New password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save()
        # Keep user logged in after password change
        login(request, request.user)
        return Response({'message': 'Password updated successfully.'})

class ActiveSessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Return real current session info & client metadata
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '127.0.0.1'))
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown Browser / Device')

        # Format user agent snippet
        device_label = "Desktop Browser"
        if "Mobile" in user_agent:
            device_label = "Mobile Device"
        elif "Tablet" in user_agent:
            device_label = "Tablet"

        sessions_data = [
            {
                'id': request.session.session_key or 'current',
                'device': device_label,
                'user_agent': user_agent[:120],
                'ip_address': ip_addr,
                'is_current': True,
                'last_activity': request.user.profile.last_seen or timezone.now()
            }
        ]
        return Response(sessions_data)

class DeactivateAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = request.user.profile
        profile.is_deactivated = True
        profile.save(update_fields=['is_deactivated'])
        logout(request)
        return Response({'message': 'Account deactivated successfully.'})

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password', '')
        confirm_text = request.data.get('confirm_text', '').strip()

        if not request.user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_text != 'DELETE':
            return Response({'error': 'Please type DELETE to confirm permanent deletion.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        logout(request)
        user.delete()
        return Response({'message': 'Account permanently deleted.'})

class MeView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False})

        profile = request.user.profile
        profile.last_seen = timezone.now()
        profile.save(update_fields=['last_seen'])

        unread_notifications = Notification.objects.filter(recipient=request.user, is_read=False).count()
        unread_messages = Message.objects.filter(
            conversation__in=request.user.conversations_as_user1.all() | request.user.conversations_as_user2.all(),
            is_read=False
        ).exclude(sender=request.user).count()

        serializer = ProfileSerializer(profile, context={'request': request})
        data = serializer.data
        data['authenticated'] = True
        data['unread_notifications_count'] = unread_notifications
        data['unread_messages_count'] = unread_messages
        return Response(data)

# -------------------------------------------------------------
# USERS & PROFILES
# -------------------------------------------------------------
class UserDetailView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        if hasattr(user, 'profile') and user.profile.is_deactivated:
            if request.user != user and not (request.user.is_authenticated and request.user.is_staff):
                return Response({'error': 'This account has been deactivated.'}, status=status.HTTP_404_NOT_FOUND)

        blocked_ids = get_blocked_user_ids(request.user)
        if user.id in blocked_ids and request.user != user:
            if Block.objects.filter(blocker=user, blocked=request.user).exists():
                return Response({'error': 'You cannot view this profile.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProfileSerializer(user.profile, context={'request': request})
        data = serializer.data

        if request.user.is_authenticated and request.user != user:
            data['has_pending_follow_request'] = FollowRequest.objects.filter(
                requester=request.user, target=user, status='pending'
            ).exists()
            data['is_muted'] = Mute.objects.filter(muter=request.user, muted=user).exists()

            # Real database mutual followers: users followed by current user who also follow target_user
            my_following = request.user.following_set.values_list('following_id', flat=True)
            mutual_users = User.objects.filter(follower_set__follower__in=my_following, follower_set__following=user).distinct()
            data['mutual_followers_count'] = mutual_users.count()
            data['mutual_followers'] = UserMinimalSerializer(mutual_users[:3], many=True, context={'request': request}).data

        return Response(data)

class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        user = request.user
        profile = user.profile

        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        bio = request.data.get('bio')
        location = request.data.get('location')
        website = request.data.get('website')
        is_private = request.data.get('is_private')
        who_can_message = request.data.get('who_can_message')
        who_can_comment = request.data.get('who_can_comment')
        remove_avatar = request.data.get('remove_avatar')
        remove_banner = request.data.get('remove_banner')

        if first_name is not None:
            user.first_name = first_name.strip()
        if last_name is not None:
            user.last_name = last_name.strip()
        user.save()

        if bio is not None:
            profile.bio = bio[:500]
        if location is not None:
            profile.location = location[:100]
        if website is not None:
            profile.website = website[:200]
        if is_private is not None:
            profile.is_private = str(is_private).lower() in ['true', '1']
        if who_can_message in ['everyone', 'followers', 'none']:
            profile.who_can_message = who_can_message
        if who_can_comment in ['everyone', 'followers', 'none']:
            profile.who_can_comment = who_can_comment

        if remove_avatar in ['true', '1', True]:
            if profile.avatar:
                profile.avatar.delete(save=False)
            profile.avatar = None

        if remove_banner in ['true', '1', True]:
            if profile.banner:
                profile.banner.delete(save=False)
            profile.banner = None

        if 'avatar' in request.FILES:
            avatar_file = request.FILES['avatar']
            if avatar_file.size > 5 * 1024 * 1024:
                return Response({'error': 'Avatar image must be under 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
            ext = avatar_file.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                return Response({'error': 'Unsupported file type. Use JPG, PNG, WEBP, or GIF.'}, status=status.HTTP_400_BAD_REQUEST)
            profile.avatar = avatar_file

        if 'banner' in request.FILES:
            banner_file = request.FILES['banner']
            if banner_file.size > 8 * 1024 * 1024:
                return Response({'error': 'Cover banner must be under 8MB.'}, status=status.HTTP_400_BAD_REQUEST)
            ext = banner_file.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                return Response({'error': 'Unsupported file type for banner.'}, status=status.HTTP_400_BAD_REQUEST)
            profile.banner = banner_file

        profile.save()
        serializer = ProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

class FollowToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target_user = get_object_or_404(User, username__iexact=username)
        if target_user == request.user:
            return Response({'error': 'You cannot follow yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check block status
        if Block.objects.filter(
            Q(blocker=request.user, blocked=target_user) | Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({'error': 'Cannot follow blocked user.'}, status=status.HTTP_400_BAD_REQUEST)

        follow_obj = Follow.objects.filter(follower=request.user, following=target_user).first()
        if follow_obj:
            follow_obj.delete()
            return Response({
                'is_following': False,
                'request_pending': False,
                'follower_count': target_user.follower_set.count()
            })

        # Check if target user has a private profile
        if hasattr(target_user, 'profile') and target_user.profile.is_private:
            req_obj = FollowRequest.objects.filter(sender=request.user, recipient=target_user, status='pending').first()
            if req_obj:
                req_obj.delete()
                return Response({
                    'is_following': False,
                    'requested': False,
                    'request_pending': False,
                    'follower_count': target_user.follower_set.count()
                })
            else:
                FollowRequest.objects.create(sender=request.user, recipient=target_user, status='pending')
                Notification.objects.create(
                    recipient=target_user,
                    actor=request.user,
                    action_type='follow_request',
                    category='social'
                )
                return Response({
                    'is_following': False,
                    'requested': True,
                    'request_pending': True,
                    'follower_count': target_user.follower_set.count()
                })

        # Public user: follow immediately
        Follow.objects.create(follower=request.user, following=target_user)
        Notification.objects.create(
            recipient=target_user,
            actor=request.user,
            action_type='follow',
            category='social'
        )
        return Response({
            'is_following': True,
            'requested': False,
            'request_pending': False,
            'follower_count': target_user.follower_set.count()
        })

class RemoveFollowerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        follower_user = get_object_or_404(User, username__iexact=username)
        Follow.objects.filter(follower=follower_user, following=request.user).delete()
        return Response({
            'message': f'Removed @{follower_user.username} from followers.',
            'follower_count': request.user.follower_set.count()
        })

class FollowRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending_requests = FollowRequest.objects.filter(recipient=request.user, status='pending').select_related('sender', 'sender__profile').order_by('-created_at')
        serializer = FollowRequestSerializer(pending_requests, many=True, context={'request': request})
        return Response(serializer.data)

class FollowRequestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        req_obj = get_object_or_404(FollowRequest, pk=pk, recipient=request.user, status='pending')
        action = request.data.get('action', '').strip().lower()

        if action == 'accept':
            req_obj.status = 'accepted'
            req_obj.save(update_fields=['status'])
            # Create Follow relationship
            Follow.objects.get_or_create(follower=req_obj.sender, following=request.user)
            # Notify sender
            Notification.objects.create(
                recipient=req_obj.sender,
                actor=request.user,
                action_type='follow',
                category='social'
            )
            return Response({'message': 'Follow request accepted.', 'status': 'accepted'})
        elif action == 'reject':
            req_obj.status = 'rejected'
            req_obj.save(update_fields=['status'])
            return Response({'message': 'Follow request rejected.', 'status': 'rejected'})
        else:
            return Response({'error': 'Invalid action. Use accept or reject.'}, status=status.HTTP_400_BAD_REQUEST)

class MuteToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target_user = get_object_or_404(User, username__iexact=username)
        if target_user == request.user:
            return Response({'error': 'You cannot mute yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        mute_obj = Mute.objects.filter(muter=request.user, muted=target_user).first()
        if mute_obj:
            mute_obj.delete()
            is_muted = False
        else:
            Mute.objects.create(muter=request.user, muted=target_user)
            is_muted = True

        return Response({'is_muted': is_muted})

class MutedUsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        muted_users = User.objects.filter(muted_by_users__muter=request.user).select_related('profile')
        serializer = UserMinimalSerializer(muted_users, many=True, context={'request': request})
        return Response(serializer.data)

class MutualFollowersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        target_user = get_object_or_404(User, username__iexact=username)
        my_following = request.user.following_set.values_list('following_id', flat=True)
        mutual_users = User.objects.filter(
            follower_set__follower__in=my_following,
            follower_set__following=target_user
        ).distinct().select_related('profile')
        serializer = UserMinimalSerializer(mutual_users, many=True, context={'request': request})
        return Response(serializer.data)

class FollowersListView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        followers = User.objects.filter(following_set__following=user).select_related('profile')
        serializer = UserMinimalSerializer(followers, many=True, context={'request': request})
        return Response(serializer.data)

class FollowingListView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        following = User.objects.filter(follower_set__follower=user).select_related('profile')
        serializer = UserMinimalSerializer(following, many=True, context={'request': request})
        return Response(serializer.data)

class BlockToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target_user = get_object_or_404(User, username__iexact=username)
        if target_user == request.user:
            return Response({'error': 'You cannot block yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        block_obj = Block.objects.filter(blocker=request.user, blocked=target_user).first()
        if block_obj:
            block_obj.delete()
            is_blocked = False
        else:
            Block.objects.create(blocker=request.user, blocked=target_user)
            is_blocked = True

        return Response({'is_blocked': is_blocked})

class BlockedUsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocked_users = User.objects.filter(blocked_by_users__blocker=request.user).select_related('profile')
        serializer = UserMinimalSerializer(blocked_users, many=True, context={'request': request})
        return Response(serializer.data)

class SuggestedUsersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            user = request.user
            blocked_ids = get_blocked_user_ids(user)
            following_ids = list(user.following_set.values_list('following_id', flat=True))
            exclude_ids = list(set([user.id] + blocked_ids + following_ids))
        else:
            exclude_ids = []

        suggested = User.objects.exclude(id__in=exclude_ids)\
            .filter(profile__is_deactivated=False)\
            .annotate(num_followers=Count('follower_set'))\
            .order_by('-num_followers', '-date_joined')[:6]\
            .select_related('profile')

        serializer = UserMinimalSerializer(suggested, many=True, context={'request': request})
        return Response(serializer.data)

# -------------------------------------------------------------
# POSTS & FEED
# -------------------------------------------------------------
class PostListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        filter_mode = request.query_params.get('filter', 'for_you')
        target_username = request.query_params.get('user')
        blocked_ids = get_blocked_user_ids(request.user)
        muted_ids = get_muted_user_ids(request.user)
        hidden_ids = get_hidden_post_ids(request.user)

        posts = Post.objects.exclude(author_id__in=blocked_ids + muted_ids)\
            .exclude(id__in=hidden_ids)\
            .select_related('author', 'author__profile', 'poll', 'repost_of', 'repost_of__author', 'repost_of__author__profile')\
            .prefetch_related('likes', 'reactions', 'comments', 'hashtags', 'poll__options', 'poll__options__votes')

        # Privacy gate: exclude posts from private accounts unless following or self
        private_user_ids = set(User.objects.filter(profile__is_private=True).values_list('id', flat=True))
        if private_user_ids:
            if request.user.is_authenticated:
                my_following = set(request.user.following_set.values_list('following_id', flat=True))
                disallowed = [uid for uid in private_user_ids if uid != request.user.id and uid not in my_following]
                posts = posts.exclude(author_id__in=disallowed)
            else:
                posts = posts.exclude(author_id__in=list(private_user_ids))

        if target_username:
            user = get_object_or_404(User, username__iexact=target_username)
            if filter_mode == 'media':
                posts = posts.filter(author=user).exclude(image='').exclude(image__isnull=True).order_by('-is_pinned', '-created_at')
            elif filter_mode == 'replies':
                commented_post_ids = Comment.objects.filter(author=user).values_list('post_id', flat=True)
                posts = posts.filter(id__in=commented_post_ids).order_by('-created_at')
            else:
                posts = posts.filter(author=user).order_by('-is_pinned', '-created_at')
        elif filter_mode == 'following' and request.user.is_authenticated:
            following_ids = request.user.following_set.values_list('following_id', flat=True)
            posts = posts.filter(author_id__in=following_ids).order_by('-created_at')
        elif filter_mode == 'latest':
            posts = posts.order_by('-created_at')
        elif filter_mode == 'popular':
            posts = posts.annotate(
                engagement=Count('likes') + Count('comments') + Count('reactions')
            ).order_by('-engagement', '-created_at')
        elif filter_mode == 'media':
            posts = posts.exclude(image='').exclude(image__isnull=True).order_by('-created_at')
        else:
            # Default 'for_you'
            if request.user.is_authenticated:
                following_ids = list(request.user.following_set.values_list('following_id', flat=True))
                if following_ids:
                    posts = posts.annotate(
                        is_followed=Case(
                            When(author_id__in=following_ids, then=Value(True)),
                            default=Value(False),
                            output_field=BooleanField()
                        )
                    ).order_by('-is_followed', '-created_at')
                else:
                    posts = posts.order_by('-created_at')
            else:
                posts = posts.order_by('-created_at')

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        content = request.data.get('content', '').strip()
        image = request.FILES.get('image')
        location = request.data.get('location', '').strip()
        feeling = request.data.get('feeling', '').strip()
        visibility = request.data.get('visibility', 'public').strip()
        allow_comments = request.data.get('allow_comments')
        repost_of_id = request.data.get('repost_of')
        poll_question = request.data.get('poll_question', '').strip()
        poll_options_raw = request.data.get('poll_options')

        repost_of = None
        if repost_of_id:
            repost_of = get_object_or_404(Post, pk=repost_of_id)

        if not content and not image and not poll_question and not repost_of:
            return Response({'error': 'Post cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        if image:
            if image.size > 10 * 1024 * 1024:
                return Response({'error': 'Image file size cannot exceed 10MB.'}, status=status.HTTP_400_BAD_REQUEST)
            ext = image.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                return Response({'error': 'Invalid image format.'}, status=status.HTTP_400_BAD_REQUEST)

        post = Post.objects.create(
            author=request.user,
            content=content,
            image=image,
            location=location[:120],
            feeling=feeling[:60],
            visibility=visibility if visibility in ['public', 'followers', 'private'] else 'public',
            allow_comments=False if str(allow_comments).lower() in ['false', '0'] else True,
            repost_of=repost_of
        )
        post.extract_hashtags()

        # Handle @mentions in post content
        import re
        mentions = re.findall(r'@([a-zA-Z0-9_]{3,30})', content)
        for m_user in User.objects.filter(username__in=mentions).exclude(id=request.user.id):
            Notification.objects.create(
                recipient=m_user,
                actor=request.user,
                action_type='mention',
                post=post,
                category='mentions'
            )

        # Notify original author if this is a repost
        if repost_of and repost_of.author != request.user:
            Notification.objects.create(
                recipient=repost_of.author,
                actor=request.user,
                action_type='repost',
                post=post,
                category='social'
            )

        # Handle Poll creation
        if poll_question:
            options = []
            if isinstance(poll_options_raw, str):
                try:
                    options = json.loads(poll_options_raw)
                except Exception:
                    options = [o.strip() for o in poll_options_raw.split(',') if o.strip()]
            elif isinstance(poll_options_raw, list):
                options = poll_options_raw

            cleaned_options = [str(opt).strip() for opt in options if str(opt).strip()]
            if len(cleaned_options) < 2:
                return Response({'error': 'Polls require at least 2 options.'}, status=status.HTTP_400_BAD_REQUEST)

            poll = Poll.objects.create(post=post, question=poll_question)
            for opt_text in cleaned_options[:5]:
                PollOption.objects.create(poll=poll, text=opt_text)

        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PostDetailView(APIView):
    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        blocked_ids = get_blocked_user_ids(request.user)
        if post.author_id in blocked_ids:
            return Response({'error': 'Content unavailable.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if post.author != request.user:
            return Response({'error': 'You do not have permission to edit this post.'}, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content', '').strip()
        location = request.data.get('location')
        feeling = request.data.get('feeling')
        allow_comments = request.data.get('allow_comments')

        if not content and not post.image and not hasattr(post, 'poll') and not post.repost_of:
            return Response({'error': 'Post content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        if content:
            post.content = content
        if location is not None:
            post.location = location[:120]
        if feeling is not None:
            post.feeling = feeling[:60]
        if allow_comments is not None:
            post.allow_comments = False if str(allow_comments).lower() in ['false', '0'] else True

        post.is_edited = True
        post.save()
        post.extract_hashtags()

        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if post.author != request.user and not (request.user.is_authenticated and request.user.is_staff):
            return Response({'error': 'You do not have permission to delete this post.'}, status=status.HTTP_403_FORBIDDEN)

        if post.image:
            post.image.delete(save=False)
        post.delete()
        return Response({'message': 'Post deleted successfully.'})

class PostLikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        like = Like.objects.filter(post=post, user=request.user).first()
        if like:
            like.delete()
            # Also remove default reaction if exists
            Reaction.objects.filter(post=post, user=request.user).delete()
            is_liked = False
            user_reaction = None
        else:
            Like.objects.create(post=post, user=request.user)
            # Create default 'like' reaction
            Reaction.objects.update_or_create(post=post, user=request.user, defaults={'reaction_type': 'like'})
            is_liked = True
            user_reaction = 'like'
            if post.author != request.user:
                Notification.objects.create(
                    recipient=post.author,
                    actor=request.user,
                    action_type='like',
                    post=post,
                    category='social'
                )

        return Response({
            'is_liked': is_liked,
            'user_reaction': user_reaction,
            'like_count': post.likes.count(),
            'reactions_count': post.reactions.count()
        })

class PostReactionToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        reaction_type = request.data.get('reaction_type', 'like').strip().lower()
        valid_reactions = ['like', 'love', 'funny', 'celebrate', 'wow', 'sad']
        if reaction_type not in valid_reactions:
            return Response({'error': 'Invalid reaction type.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = Reaction.objects.filter(post=post, user=request.user).first()
        if existing and existing.reaction_type == reaction_type:
            # Toggle off
            existing.delete()
            Like.objects.filter(post=post, user=request.user).delete()
            user_reaction = None
            is_liked = False
        else:
            # Add or update reaction
            Reaction.objects.update_or_create(post=post, user=request.user, defaults={'reaction_type': reaction_type})
            Like.objects.get_or_create(post=post, user=request.user)
            user_reaction = reaction_type
            is_liked = True

            if post.author != request.user:
                Notification.objects.create(
                    recipient=post.author,
                    actor=request.user,
                    action_type='reaction',
                    post=post,
                    category='social'
                )

        # Build summary
        summary = {r: 0 for r in valid_reactions}
        for r in post.reactions.values('reaction_type').annotate(c=Count('id')):
            summary[r['reaction_type']] = r['c']

        return Response({
            'is_liked': is_liked,
            'user_reaction': user_reaction,
            'current_reaction': user_reaction,
            'like_count': post.likes.count(),
            'total_reactions': post.reactions.count(),
            'reactions_count': summary,
            'reactions_summary': summary
        })

class PostHideView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        hidden = HiddenPost.objects.filter(user=request.user, post=post).first()
        if hidden:
            hidden.delete()
            return Response({'is_hidden': False, 'message': 'Post unhidden from feed.'})
        else:
            HiddenPost.objects.create(user=request.user, post=post)
            return Response({'is_hidden': True, 'message': 'Post hidden from feed.'})

class PostPinToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk, author=request.user)
        if post.is_pinned:
            post.is_pinned = False
            post.save(update_fields=['is_pinned'])
            if request.user.profile.pinned_post == post:
                request.user.profile.pinned_post = None
                request.user.profile.save(update_fields=['pinned_post'])
            return Response({'is_pinned': False, 'message': 'Post unpinned from profile.'})
        else:
            # Unpin any previous pinned posts
            Post.objects.filter(author=request.user, is_pinned=True).update(is_pinned=False)
            post.is_pinned = True
            post.save(update_fields=['is_pinned'])
            request.user.profile.pinned_post = post
            request.user.profile.save(update_fields=['pinned_post'])
            return Response({'is_pinned': True, 'message': 'Post pinned to top of profile.'})

class PostBookmarkToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        bookmark = Bookmark.objects.filter(post=post, user=request.user).first()
        if bookmark:
            bookmark.delete()
            is_bookmarked = False
        else:
            Bookmark.objects.create(post=post, user=request.user)
            is_bookmarked = True

        return Response({
            'is_bookmarked': is_bookmarked,
            'bookmarks_count': post.bookmarks.count()
        })

class PostVoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not hasattr(post, 'poll'):
            return Response({'error': 'This post does not contain a poll.'}, status=status.HTTP_400_BAD_REQUEST)

        poll = post.poll
        option_id = request.data.get('option_id')
        option = get_object_or_404(PollOption, id=option_id, poll=poll)

        if PollVote.objects.filter(poll=poll, user=request.user).exists():
            return Response({'error': 'You have already voted in this poll.'}, status=status.HTTP_400_BAD_REQUEST)

        PollVote.objects.create(poll=poll, poll_option=option, user=request.user)
        serializer = PollSerializer(poll, context={'request': request})
        return Response(serializer.data)

class PostDraftListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        drafts = PostDraft.objects.filter(user=request.user).order_by('-updated_at')
        serializer = PostDraftSerializer(drafts, many=True)
        return Response(serializer.data)

    def post(self, request):
        content = request.data.get('content', '').strip()
        location = request.data.get('location', '').strip()
        feeling = request.data.get('feeling', '').strip()

        if not content:
            return Response({'error': 'Draft cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        draft = PostDraft.objects.create(
            user=request.user,
            content=content,
            location=location,
            feeling=feeling
        )
        serializer = PostDraftSerializer(draft)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PostDraftDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        draft = get_object_or_404(PostDraft, pk=pk, user=request.user)
        draft.delete()
        return Response({'message': 'Draft deleted.'})

class UserBookmarksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collection_id = request.query_params.get('collection')
        saved_posts = Post.objects.filter(bookmarks__user=request.user)\
            .select_related('author', 'author__profile', 'poll', 'repost_of', 'repost_of__author')\
            .prefetch_related('likes', 'reactions', 'comments', 'hashtags', 'poll__options', 'poll__options__votes')

        if collection_id:
            saved_posts = saved_posts.filter(collection_items__collection_id=collection_id, collection_items__collection__user=request.user)

        saved_posts = saved_posts.order_by('-bookmarks__created_at')

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(saved_posts, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class BookmarkCollectionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collections = BookmarkCollection.objects.filter(user=request.user).annotate(
            items_count=Count('items')
        ).order_by('-created_at')
        serializer = BookmarkCollectionSerializer(collections, many=True)
        return Response(serializer.data)

    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Collection name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        collection, _ = BookmarkCollection.objects.get_or_create(user=request.user, name=name[:80])
        serializer = BookmarkCollectionSerializer(collection)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class BookmarkCollectionItemToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        post_id = request.data.get('post_id')
        collection_id = request.data.get('collection_id')

        if post_id:
            collection = get_object_or_404(BookmarkCollection, pk=pk, user=request.user)
            post = get_object_or_404(Post, pk=post_id)
        elif collection_id:
            post = get_object_or_404(Post, pk=pk)
            collection = get_object_or_404(BookmarkCollection, pk=collection_id, user=request.user)
        else:
            return Response({'error': 'Missing post_id or collection_id.'}, status=status.HTTP_400_BAD_REQUEST)

        bookmark, _ = Bookmark.objects.get_or_create(user=request.user, post=post)
        item = BookmarkCollectionItem.objects.filter(collection=collection, bookmark=bookmark).first()
        if item:
            item.delete()
            return Response({'in_collection': False, 'item_count': collection.items.count(), 'message': f'Removed from {collection.name}'})
        else:
            BookmarkCollectionItem.objects.create(collection=collection, bookmark=bookmark)
            return Response({'in_collection': True, 'item_count': collection.items.count(), 'message': f'Saved to {collection.name}'})

class UserLikedPostsView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        blocked_ids = get_blocked_user_ids(request.user)
        if user.id in blocked_ids:
            return Response({'error': 'Unavailable.'}, status=status.HTTP_403_FORBIDDEN)

        liked_posts = Post.objects.filter(likes__user=user)\
            .exclude(author_id__in=blocked_ids)\
            .select_related('author', 'author__profile', 'poll', 'repost_of', 'repost_of__author')\
            .prefetch_related('likes', 'reactions', 'comments', 'hashtags', 'poll__options', 'poll__options__votes')\
            .order_by('-likes__created_at')

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(liked_posts, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

# -------------------------------------------------------------
# COMMENTS & REPLIES
# -------------------------------------------------------------
class PostCommentsView(APIView):
    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        blocked_ids = get_blocked_user_ids(request.user)
        sort_mode = request.query_params.get('sort', 'newest')

        comments = Comment.objects.filter(post=post, parent__isnull=True)\
            .exclude(author_id__in=blocked_ids)\
            .select_related('author', 'author__profile')\
            .prefetch_related('replies__author', 'replies__author__profile', 'likes')

        if sort_mode == 'top':
            comments = comments.annotate(num_likes=Count('likes')).order_by('-num_likes', '-created_at')
        elif sort_mode == 'oldest':
            comments = comments.order_by('created_at')
        else:
            comments = comments.order_by('-created_at')

        serializer = CommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        post = get_object_or_404(Post, pk=pk)

        # Check if comments are allowed
        if not post.allow_comments:
            return Response({'error': 'Comments are disabled on this post.'}, status=status.HTTP_403_FORBIDDEN)

        # Check author privacy settings on comments
        author_profile = getattr(post.author, 'profile', None)
        if author_profile and author_profile.who_can_comment == 'followers' and post.author != request.user:
            if not Follow.objects.filter(follower=request.user, following=post.author).exists():
                return Response({'error': 'Only followers can comment on this post.'}, status=status.HTTP_403_FORBIDDEN)
        elif author_profile and author_profile.who_can_comment == 'none' and post.author != request.user:
            return Response({'error': 'Comments are turned off.'}, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content', '').strip()
        parent_id = request.data.get('parent_id')

        if not content:
            return Response({'error': 'Comment cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        if parent_id:
            parent = get_object_or_404(Comment, pk=parent_id, post=post)

        comment = Comment.objects.create(
            post=post,
            author=request.user,
            parent=parent,
            content=content
        )

        # Mention notifications in comments
        import re
        mentions = re.findall(r'@([a-zA-Z0-9_]{3,30})', content)
        for m_user in User.objects.filter(username__in=mentions).exclude(id=request.user.id):
            Notification.objects.create(
                recipient=m_user,
                actor=request.user,
                action_type='mention',
                post=post,
                comment=comment,
                category='mentions'
            )

        # Trigger notification
        if parent:
            if parent.author != request.user:
                Notification.objects.create(
                    recipient=parent.author,
                    actor=request.user,
                    action_type='reply',
                    post=post,
                    comment=comment,
                    category='social'
                )
        else:
            if post.author != request.user:
                Notification.objects.create(
                    recipient=post.author,
                    actor=request.user,
                    action_type='comment',
                    post=post,
                    comment=comment,
                    category='social'
                )

        serializer = CommentSerializer(comment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class CommentLikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        c_like = CommentLike.objects.filter(comment=comment, user=request.user).first()
        if c_like:
            c_like.delete()
            is_liked = False
        else:
            CommentLike.objects.create(comment=comment, user=request.user)
            is_liked = True

        return Response({
            'is_liked': is_liked,
            'like_count': comment.likes.count(),
            'likes_count': comment.likes.count()
        })

class CommentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        if comment.author != request.user and comment.post.author != request.user and not (request.user.is_staff):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        comment.delete()
        return Response({'message': 'Comment deleted successfully.'})

# -------------------------------------------------------------
# EXPLORE, SEARCH & TRENDING
# -------------------------------------------------------------
class TrendingHashtagsView(APIView):
    def get(self, request):
        hashtags = Hashtag.objects.annotate(num_posts=Count('posts'))\
            .filter(num_posts__gt=0)\
            .order_by('-num_posts')[:10]
        data = [{'name': h.name, 'post_count': h.num_posts} for h in hashtags]
        return Response(data)

class PopularPostsView(APIView):
    def get(self, request):
        blocked_ids = get_blocked_user_ids(request.user)
        posts = Post.objects.exclude(author_id__in=blocked_ids)\
            .annotate(engagement=Count('likes') + Count('comments'))\
            .order_by('-engagement', '-created_at')[:15]\
            .select_related('author', 'author__profile', 'poll')\
            .prefetch_related('likes', 'comments', 'hashtags', 'poll__options', 'poll__options__votes')

        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

class SearchView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({
                'people': [],
                'users': [],
                'posts': [],
                'hashtags': [],
                'tags': []
            })

        blocked_ids = get_blocked_user_ids(request.user)

        # People search
        people = User.objects.exclude(id__in=blocked_ids).filter(
            Q(username__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q)
        ).select_related('profile')[:8]

        # Posts search
        posts = Post.objects.exclude(author_id__in=blocked_ids).filter(
            content__icontains=q
        ).select_related('author', 'author__profile', 'poll')\
         .prefetch_related('likes', 'comments', 'hashtags', 'poll__options')[:10]

        # Hashtags search
        clean_tag = q.lstrip('#')
        hashtags = Hashtag.objects.filter(name__icontains=clean_tag)\
            .annotate(num_posts=Count('posts'))\
            .order_by('-num_posts')[:8]

        people_data = UserMinimalSerializer(people, many=True, context={'request': request}).data
        posts_data = PostSerializer(posts, many=True, context={'request': request}).data
        hashtag_data = [{'name': h.name, 'post_count': h.num_posts} for h in hashtags]

        return Response({
            'people': people_data,
            'users': people_data,
            'posts': posts_data,
            'hashtags': hashtag_data,
            'tags': hashtag_data,
        })

class HashtagPostsView(APIView):
    def get(self, request, name):
        tag_clean = name.lstrip('#').lower()
        hashtag = get_object_or_404(Hashtag, name=tag_clean)
        blocked_ids = get_blocked_user_ids(request.user)

        posts = hashtag.posts.exclude(author_id__in=blocked_ids)\
            .select_related('author', 'author__profile', 'poll')\
            .prefetch_related('likes', 'comments', 'hashtags', 'poll__options')\
            .order_by('-created_at')

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

# -------------------------------------------------------------
# NOTIFICATIONS
# -------------------------------------------------------------
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category = request.query_params.get('category', 'all').strip().lower()
        notifications = Notification.objects.filter(recipient=request.user)\
            .select_related('actor', 'actor__profile', 'post')

        if category in ['social', 'mentions', 'messages']:
            notifications = notifications.filter(category=category)

        notifications = notifications.order_by('-created_at')
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(notifications, request)
        serializer = NotificationSerializer(page, many=True, context={'request': request})
        res = paginator.get_paginated_response(serializer.data)
        res.data['unread_count'] = unread_count
        return res

class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'is_read': True})

class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read.'})

# -------------------------------------------------------------
# DIRECT MESSAGING
# -------------------------------------------------------------
class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = Conversation.objects.filter(
            Q(user1=request.user) | Q(user2=request.user)
        ).order_by('-updated_at')

        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return Response(serializer.data)

class StartConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_username = request.data.get('username', '').strip()
        target_user = get_object_or_404(User, username__iexact=target_username)

        if target_user == request.user:
            return Response({'error': 'Cannot start a conversation with yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check block status
        if Block.objects.filter(
            Q(blocker=request.user, blocked=target_user) | Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({'error': 'Messaging is restricted with this user.'}, status=status.HTTP_400_BAD_REQUEST)

        conv = Conversation.get_or_create_between(request.user, target_user)
        serializer = ConversationSerializer(conv, context={'request': request})
        return Response(serializer.data)

class ConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        conv = get_object_or_404(Conversation, pk=pk)
        if conv.user1 != request.user and conv.user2 != request.user:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Mark messages received by current user as read
        conv.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        messages = conv.messages.select_related('sender', 'sender__profile').order_by('created_at')
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        conv = get_object_or_404(Conversation, pk=pk)
        if conv.user1 != request.user and conv.user2 != request.user:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        other_user = conv.get_other_user(request.user)
        # Check block status
        if Block.objects.filter(
            Q(blocker=request.user, blocked=other_user) | Q(blocker=other_user, blocked=request.user)
        ).exists():
            return Response({'error': 'Cannot send messages to this user.'}, status=status.HTTP_400_BAD_REQUEST)

        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(
            conversation=conv,
            sender=request.user,
            text=text
        )
        conv.updated_at = timezone.now()
        conv.save(update_fields=['updated_at'])

        serializer = MessageSerializer(msg, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MessageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        msg = get_object_or_404(Message, pk=pk)
        if msg.sender != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        msg.delete()
        return Response({'message': 'Message deleted.'})

class MessageReactionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        msg = get_object_or_404(Message, pk=pk)
        conv = msg.conversation
        if conv.user1 != request.user and conv.user2 != request.user:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        emoji = request.data.get('emoji', '❤️').strip()[:10]
        existing = MessageReaction.objects.filter(message=msg, user=request.user).first()
        if existing and existing.emoji == emoji:
            existing.delete()
            return Response({'message': 'Reaction removed.', 'reactions': MessageSerializer(msg).data['reactions']})

        MessageReaction.objects.update_or_create(message=msg, user=request.user, defaults={'emoji': emoji})
        return Response({'message': 'Reaction saved.', 'reactions': MessageSerializer(msg).data['reactions']})

class MessagePinToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        msg = get_object_or_404(Message, pk=pk)
        conv = msg.conversation
        if conv.user1 != request.user and conv.user2 != request.user:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        msg.is_pinned = not msg.is_pinned
        msg.save(update_fields=['is_pinned'])
        return Response({'is_pinned': msg.is_pinned, 'message': 'Message pin status updated.'})

# -------------------------------------------------------------
# REPORTS
# -------------------------------------------------------------
class ReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_type = request.data.get('target_type')
        target_id = request.data.get('target_id')
        if not target_type and request.data.get('post'):
            target_type = 'post'
            target_id = request.data.get('post')
        elif not target_type and request.data.get('user'):
            target_type = 'user'
            target_id = request.data.get('user')
        elif not target_type and request.data.get('comment'):
            target_type = 'comment'
            target_id = request.data.get('comment')

        reason = request.data.get('reason')
        details = request.data.get('details', '')

        if not target_type or not target_id or not reason:
            return Response({'error': 'Missing required fields.'}, status=status.HTTP_400_BAD_REQUEST)

        Report.objects.create(
            reporter=request.user,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            details=details
        )
        return Response({'message': 'Report received. Thank you for keeping Vibely safe.'}, status=status.HTTP_201_CREATED)

# -------------------------------------------------------------
# STORIES / MOMENTS (24-Hour Expiration)
# -------------------------------------------------------------
class StoryListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        cutoff = timezone.now() - timezone.timedelta(hours=24)
        blocked_ids = get_blocked_user_ids(request.user)

        stories = Story.objects.filter(created_at__gte=cutoff)\
            .exclude(user_id__in=blocked_ids)\
            .select_related('user', 'user__profile')\
            .order_by('-created_at')

        # Group by user
        groups = {}
        for story in stories:
            uid = story.user.id
            if uid not in groups:
                groups[uid] = {
                    'user': UserMinimalSerializer(story.user, context={'request': request}).data,
                    'has_unseen': True,
                    'stories': []
                }
            groups[uid]['stories'].append(StorySerializer(story, context={'request': request}).data)

        # Sort: Self first, then followed users, then others
        ordered = []
        user = request.user
        following_ids = set(user.following_set.values_list('following_id', flat=True)) if user.is_authenticated else set()

        if user.is_authenticated and user.id in groups:
            ordered.append(groups.pop(user.id))

        followed_groups = [g for uid, g in groups.items() if uid in following_ids]
        other_groups = [g for uid, g in groups.items() if uid not in following_ids]

        ordered.extend(followed_groups)
        ordered.extend(other_groups)

        return Response(ordered)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        caption = request.data.get('caption', '').strip()
        bg_color = request.data.get('background_color', 'linear-gradient(135deg, #FF6B6B, #FFA07A)')
        media = request.FILES.get('media')

        if not caption and not media:
            return Response({'error': 'A Moment requires either text or an image.'}, status=status.HTTP_400_BAD_REQUEST)

        if media:
            if media.size > 10 * 1024 * 1024:
                return Response({'error': 'Moment media cannot exceed 10MB.'}, status=status.HTTP_400_BAD_REQUEST)
            ext = media.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                return Response({'error': 'Invalid image format.'}, status=status.HTTP_400_BAD_REQUEST)

        story = Story.objects.create(
            user=request.user,
            media=media,
            caption=caption[:280],
            background_color=bg_color[:50]
        )

        serializer = StorySerializer(story, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class StoryViewRecordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        story = get_object_or_404(Story, pk=pk)
        if story.user != request.user:
            StoryView.objects.get_or_create(story=story, viewer=request.user)
            # Notify story owner
            Notification.objects.create(
                recipient=story.user,
                actor=request.user,
                action_type='story_view',
                category='social'
            )
        return Response({'viewers_count': story.views.count()})

class StoryHighlightListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        username = request.query_params.get('user')
        if not username:
            return Response({'error': 'User parameter required.'}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(User, username__iexact=username)
        highlights = StoryHighlight.objects.filter(user=user).prefetch_related('stories').order_by('-created_at')
        serializer = StoryHighlightSerializer(highlights, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        title = request.data.get('title', '').strip()[:60]
        cover_image = request.FILES.get('cover_image')
        story_ids_raw = request.data.get('story_ids')

        if not title:
            return Response({'error': 'Highlight title is required.'}, status=status.HTTP_400_BAD_REQUEST)

        highlight = StoryHighlight.objects.create(
            user=request.user,
            title=title,
            cover_image=cover_image
        )

        if story_ids_raw:
            story_ids = []
            if isinstance(story_ids_raw, str):
                try:
                    story_ids = json.loads(story_ids_raw)
                except Exception:
                    story_ids = [int(s.strip()) for s in story_ids_raw.split(',') if s.strip().isdigit()]
            elif isinstance(story_ids_raw, list):
                story_ids = [int(s) for s in story_ids_raw if str(s).isdigit()]

            valid_stories = Story.objects.filter(id__in=story_ids, user=request.user)
            highlight.stories.set(valid_stories)

        serializer = StoryHighlightSerializer(highlight, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# -------------------------------------------------------------
# USER REAL ACTIVITY & ANALYTICS
# -------------------------------------------------------------
class UserActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 100% Real Database Counts
        stats = {
            'posts_count': user.posts.count(),
            'likes_received': Like.objects.filter(post__author=user).count(),
            'comments_written': user.comments.count(),
            'followers_count': user.follower_set.count(),
            'following_count': user.following_set.count(),
            'saved_posts_count': user.post_bookmarks.count(),
            'active_moments_count': user.stories.filter(created_at__gte=timezone.now() - timezone.timedelta(hours=24)).count()
        }

        # Real chronological activities
        timeline = []

        # Recent Posts
        for p in user.posts.order_by('-created_at')[:5]:
            snippet = p.content[:60] + ('...' if len(p.content) > 60 else '') if p.content else 'Media Post'
            timeline.append({
                'type': 'post',
                'icon': '📝',
                'action': f'Published: "{snippet}"',
                'target_url': f'feed.html#post-{p.id}',
                'created_at': p.created_at
            })

        # Recent Likes
        for l in Like.objects.filter(user=user).select_related('post', 'post__author').order_by('-created_at')[:5]:
            timeline.append({
                'type': 'like',
                'icon': '❤️',
                'action': f'Liked @{l.post.author.username}\'s post',
                'target_url': f'feed.html#post-{l.post.id}',
                'created_at': l.created_at
            })

        # Recent Comments
        for c in user.comments.select_related('post', 'post__author').order_by('-created_at')[:5]:
            timeline.append({
                'type': 'comment',
                'icon': '💬',
                'action': f'Commented on @{c.post.author.username}\'s post: "{c.content[:40]}"',
                'target_url': f'feed.html#post-{c.post.id}',
                'created_at': c.created_at
            })

        # Recent Follows
        for f in Follow.objects.filter(follower=user).select_related('following').order_by('-created_at')[:5]:
            timeline.append({
                'type': 'follow',
                'icon': '👤',
                'action': f'Started following @{f.following.username}',
                'target_url': f'profile.html?u={f.following.username}',
                'created_at': f.created_at
            })

        timeline.sort(key=lambda item: item['created_at'], reverse=True)

        return Response({
            'stats': stats,
            'timeline': timeline[:15]
        })

# -------------------------------------------------------------
# ADMIN & MODERATION DASHBOARD (Staff Only)
# -------------------------------------------------------------
class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required.'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        day_ago = now - timezone.timedelta(hours=24)

        data = {
            'total_users': User.objects.count(),
            'total_posts': Post.objects.count(),
            'total_comments': Comment.objects.count(),
            'total_reports': Report.objects.count(),
            'pending_reports': Report.objects.filter(status='pending').count(),
            'active_moments': Story.objects.filter(created_at__gte=day_ago).count(),
            'recent_signups': UserMinimalSerializer(User.objects.order_by('-date_joined')[:6], many=True, context={'request': request}).data,
            'recent_posts': PostSerializer(Post.objects.order_by('-created_at')[:5], many=True, context={'request': request}).data
        }
        return Response(data)

class AdminReportsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required.'}, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status', 'all')
        reports = Report.objects.select_related('reporter', 'reporter__profile', 'resolved_by').order_by('-created_at')

        if status_filter in ['pending', 'resolved', 'dismissed']:
            reports = reports.filter(status=status_filter)

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(reports, request)
        serializer = ReportAdminSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class AdminReportResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required.'}, status=status.HTTP_403_FORBIDDEN)

        report = get_object_or_404(Report, pk=pk)
        action = (request.data.get('action') or request.data.get('status') or 'dismiss').strip().lower()

        if action in ['dismiss', 'dismissed']:
            report.status = 'dismissed'
            report.resolved_by = request.user
            report.resolved_at = timezone.now()
            report.save()
            return Response({'message': 'Report dismissed.', 'status': 'dismissed'})
        elif action in ['warn', 'remove_post', 'ban_user', 'resolve', 'resolved']:
            report.status = 'resolved'
            report.resolved_by = request.user
            report.resolved_at = timezone.now()
            report.save()

            # Execute enforcement
            if action == 'remove_post' and report.target_type == 'post':
                try:
                    Post.objects.filter(id=report.target_id).delete()
                except Exception:
                    pass
            elif action == 'ban_user' and report.target_type == 'user':
                try:
                    target_u = User.objects.filter(id=report.target_id).first()
                    if target_u and hasattr(target_u, 'profile'):
                        target_u.profile.is_deactivated = True
                        target_u.profile.save(update_fields=['is_deactivated'])
                except Exception:
                    pass

            return Response({'message': f'Report resolved with action: {action}', 'status': 'resolved'})
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

class AdminUserBanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required.'}, status=status.HTTP_403_FORBIDDEN)

        target_user = get_object_or_404(User, username__iexact=username)
        if target_user.is_superuser:
            return Response({'error': 'Cannot ban superusers.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = target_user.profile
        profile.is_deactivated = not profile.is_deactivated
        profile.save(update_fields=['is_deactivated'])

        action_word = "deactivated" if profile.is_deactivated else "reactivated"
        return Response({'is_deactivated': profile.is_deactivated, 'message': f'User @{target_user.username} {action_word}.'})

class AdminPostDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Staff access required.'}, status=status.HTTP_403_FORBIDDEN)

        post = get_object_or_404(Post, pk=pk)
        if post.image:
            post.image.delete(save=False)
        post.delete()
        return Response({'message': 'Post permanently removed by moderator.'})
