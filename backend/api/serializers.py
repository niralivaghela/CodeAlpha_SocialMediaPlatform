from rest_framework import serializers
from django.contrib.auth.models import User
from accounts.models import Profile
from posts.models import (
    Post, Hashtag, Poll, PollOption, PollVote, Like, Bookmark,
    Story, Reaction, PostDraft, BookmarkCollection, BookmarkCollectionItem,
    StoryView, StoryHighlight
)
from comments.models import Comment, CommentLike
from social.models import Follow, Block, Report, FollowRequest, Mute, HiddenPost
from notifications.models import Notification
from messaging.models import Conversation, Message, MessageReaction

class UserMinimalSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='profile.display_name', read_only=True)
    initials = serializers.CharField(source='profile.initials', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    presence_status = serializers.CharField(source='profile.presence_status', read_only=True)
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    is_verified = serializers.BooleanField(source='profile.is_verified', read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'display_name', 'initials', 'avatar_url', 'presence_status', 'is_online', 'is_verified', 'is_following']

    def get_avatar_url(self, obj):
        if hasattr(obj, 'profile') and obj.profile.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile.avatar.url)
            return obj.profile.avatar.url
        return None

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        return Follow.objects.filter(follower=request.user, following=obj).exists()

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    display_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    presence_status = serializers.CharField(read_only=True)
    is_online = serializers.BooleanField(read_only=True)
    post_count = serializers.SerializerMethodField()
    follower_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()
    has_pending_request = serializers.SerializerMethodField()
    has_pending_follow_request = serializers.SerializerMethodField()
    mutual_followers_sample = serializers.SerializerMethodField()
    mutual_followers = serializers.SerializerMethodField()
    mutual_followers_count = serializers.SerializerMethodField()
    pinned_post_id = serializers.IntegerField(read_only=True, allow_null=True)

    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'display_name',
            'initials', 'avatar_url', 'banner_url', 'bio', 'location', 'website',
            'is_private', 'is_verified', 'is_deactivated', 'pinned_post_id',
            'who_can_message', 'who_can_comment', 'presence_status', 'is_online',
            'post_count', 'follower_count', 'following_count', 'is_following',
            'is_self', 'is_blocked', 'is_muted', 'has_pending_request',
            'has_pending_follow_request', 'mutual_followers_sample',
            'mutual_followers', 'mutual_followers_count', 'created_at', 'is_staff', 'is_superuser'
        ]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_banner_url(self, obj):
        if obj.banner:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.banner.url)
            return obj.banner.url
        return None

    def get_post_count(self, obj):
        return obj.user.posts.count()

    def get_follower_count(self, obj):
        return obj.user.follower_set.count()

    def get_following_count(self, obj):
        return obj.user.following_set.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj.user:
            return False
        return Follow.objects.filter(follower=request.user, following=obj.user).exists()

    def get_is_self(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return request.user == obj.user

    def get_is_blocked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Block.objects.filter(blocker=request.user, blocked=obj.user).exists()

    def get_is_muted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Mute.objects.filter(muter=request.user, muted=obj.user).exists()

    def get_has_pending_request(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return FollowRequest.objects.filter(sender=request.user, recipient=obj.user, status='pending').exists()

    def get_has_pending_follow_request(self, obj):
        return self.get_has_pending_request(obj)

    def get_mutual_followers_sample(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj.user:
            return []
        # Users that request.user follows AND that follow obj.user
        my_following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
        mutual_users = User.objects.filter(id__in=my_following_ids, following_set__following=obj.user).select_related('profile')[:3]
        return [{'username': u.username, 'display_name': u.profile.display_name} for u in mutual_users]

    def get_mutual_followers(self, obj):
        return self.get_mutual_followers_sample(obj)

    def get_mutual_followers_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj.user:
            return 0
        my_following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
        return User.objects.filter(id__in=my_following_ids, following_set__following=obj.user).count()

class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.IntegerField(read_only=True)
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'vote_count', 'percentage']

    def get_percentage(self, obj):
        total = obj.poll.total_votes
        if total == 0:
            return 0
        return round((obj.vote_count / total) * 100, 1)

class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.IntegerField(read_only=True)
    user_voted_option_id = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = ['id', 'question', 'options', 'total_votes', 'user_voted_option_id', 'created_at']

    def get_user_voted_option_id(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        vote = PollVote.objects.filter(poll=obj, user=request.user).first()
        return vote.poll_option_id if vote else None

class HashtagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hashtag
        fields = ['id', 'name', 'post_count']

class PostMinimalReprSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'image_url', 'created_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

class PostSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()
    reactions_count = serializers.SerializerMethodField()
    reaction_breakdown = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_own_post = serializers.SerializerMethodField()
    repost_of_data = serializers.SerializerMethodField()
    poll = PollSerializer(read_only=True)
    hashtags = serializers.SlugRelatedField(many=True, read_only=True, slug_field='name')

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'image', 'image_url', 'hashtags',
            'location', 'feeling', 'allow_comments', 'visibility', 'is_pinned',
            'repost_of', 'repost_of_data', 'reposts_count',
            'is_edited', 'created_at', 'updated_at', 'like_count',
            'comment_count', 'reactions_count', 'reaction_breakdown', 'user_reaction',
            'is_liked', 'is_bookmarked', 'is_own_post', 'poll'
        ]
        extra_kwargs = {'image': {'write_only': True, 'required': False}}

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_reposts_count(self, obj):
        return obj.reposts.count()

    def get_reactions_count(self, obj):
        r_count = obj.reactions.count()
        return r_count if r_count > 0 else obj.likes.count()

    def get_reaction_breakdown(self, obj):
        breakdown = {}
        for r in obj.reactions.all():
            breakdown[r.reaction_type] = breakdown.get(r.reaction_type, 0) + 1
        return breakdown

    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        r = obj.reactions.filter(user=request.user).first()
        if r:
            return r.reaction_type
        if Like.objects.filter(post=obj, user=request.user).exists():
            return 'like'
        return None

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Like.objects.filter(post=obj, user=request.user).exists() or obj.reactions.filter(user=request.user).exists()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Bookmark.objects.filter(post=obj, user=request.user).exists()

    def get_is_own_post(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.author == request.user

    def get_repost_of_data(self, obj):
        if obj.repost_of:
            return PostMinimalReprSerializer(obj.repost_of, context=self.context).data
        return None

class CommentReplySerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_own_comment = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author', 'parent', 'content', 'likes_count', 'is_liked', 'created_at', 'is_own_comment']

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return CommentLike.objects.filter(comment=obj, user=request.user).exists()

    def get_is_own_comment(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.author == request.user

class CommentSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_own_comment = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author', 'post', 'parent', 'content', 'likes_count', 'is_liked', 'created_at', 'replies', 'is_own_comment']
        read_only_fields = ['post']

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return CommentLike.objects.filter(comment=obj, user=request.user).exists()

    def get_replies(self, obj):
        if obj.parent is None:
            replies = obj.replies.all().order_by('created_at')
            return CommentReplySerializer(replies, many=True, context=self.context).data
        return []

    def get_is_own_comment(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.author == request.user

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserMinimalSerializer(read_only=True)
    post_id = serializers.IntegerField(source='post.id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = ['id', 'actor', 'action_type', 'category', 'post_id', 'comment', 'is_read', 'created_at']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    is_own = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'text', 'is_read', 'is_deleted', 'is_pinned', 'reactions', 'created_at', 'is_own']
        read_only_fields = ['conversation']

    def get_is_own(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.sender == request.user

    def get_reactions(self, obj):
        return [{'username': r.user.username, 'emoji': r.reaction_type} for r in obj.reactions.all()]

class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'other_user', 'last_message', 'unread_count', 'updated_at']

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        other = obj.get_other_user(request.user)
        return UserMinimalSerializer(other, context=self.context).data

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at').first()
        if last:
            return {
                'id': last.id,
                'text': 'This message was deleted' if last.is_deleted else last.text,
                'sender_username': last.sender.username,
                'created_at': last.created_at,
                'is_read': last.is_read,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()

class StorySerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    media_url = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()
    views_count = serializers.SerializerMethodField()
    has_viewed = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ['id', 'user', 'media_url', 'caption', 'background_color', 'views_count', 'has_viewed', 'created_at', 'is_own']

    def get_media_url(self, obj):
        if obj.media:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.media.url)
            return obj.media.url
        return None

    def get_is_own(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.user == request.user

    def get_views_count(self, obj):
        return obj.views.count()

    def get_has_viewed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.views.filter(viewer=request.user).exists()

class PostDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostDraft
        fields = ['id', 'content', 'location', 'feeling', 'created_at', 'updated_at']

class BookmarkCollectionSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = BookmarkCollection
        fields = ['id', 'name', 'item_count', 'created_at']

    def get_item_count(self, obj):
        return obj.items.count()

class StoryHighlightSerializer(serializers.ModelSerializer):
    stories = StorySerializer(many=True, read_only=True)
    story_count = serializers.SerializerMethodField()

    class Meta:
        model = StoryHighlight
        fields = ['id', 'title', 'cover_image', 'stories', 'story_count', 'created_at']

    def get_story_count(self, obj):
        return obj.stories.count()

class FollowRequestSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)

    class Meta:
        model = FollowRequest
        fields = ['id', 'sender', 'status', 'created_at']

class ReportAdminSerializer(serializers.ModelSerializer):
    reporter = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Report
        fields = ['id', 'reporter', 'target_type', 'target_id', 'reason', 'details', 'status', 'resolved_at', 'created_at']
