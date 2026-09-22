from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from posts.models import Post, Hashtag, Poll, PollOption, PollVote, Like, Bookmark, Story
from comments.models import Comment
from social.models import Follow
from messaging.models import Conversation, Message
from notifications.models import Notification

class Command(BaseCommand):
    help = 'Seeds realistic, clearly-labeled demo accounts and content for evaluation'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Seeding demo data for Vibely...'))

        # 1. Create Demo Users
        users_data = [
            {
                'username': 'alex_demo',
                'email': 'alex@demo.vibely.local',
                'first_name': 'Alex',
                'last_name': 'Rivera',
                'password': 'DemoPassword123!',
                'bio': 'Full-stack software engineer & open-source builder. Loving the clean vibes here! #vibely #python #webdevelopment',
                'location': 'San Francisco, CA',
                'website': 'https://alexrivera.dev',
            },
            {
                'username': 'sophia_demo',
                'email': 'sophia@demo.vibely.local',
                'first_name': 'Sophia',
                'last_name': 'Chen',
                'password': 'DemoPassword123!',
                'bio': 'Product designer & creative technologist. Passionate about typography and micro-interactions. #design #uiux',
                'location': 'Seattle, WA',
                'website': 'https://sophiachen.design',
            },
            {
                'username': 'david_demo',
                'email': 'david@demo.vibely.local',
                'first_name': 'David',
                'last_name': 'Kim',
                'password': 'DemoPassword123!',
                'bio': 'Backend systems enthusiast, database optimizer, and coffee brewer. #python #backend #postgres',
                'location': 'Austin, TX',
                'website': '',
            },
            {
                'username': 'elena_demo',
                'email': 'elena@demo.vibely.local',
                'first_name': 'Elena',
                'last_name': 'Rostova',
                'password': 'DemoPassword123!',
                'bio': 'AI researcher exploring foundation models and human-computer interfaces. #ai #machinelearning #future',
                'location': 'New York, NY',
                'website': '',
            },
        ]

        created_users = {}
        for u in users_data:
            user, created = User.objects.get_or_create(
                username=u['username'],
                defaults={
                    'email': u['email'],
                    'first_name': u['first_name'],
                    'last_name': u['last_name'],
                }
            )
            user.set_password(u['password'])
            user.save()

            profile = user.profile
            profile.bio = u['bio']
            profile.location = u['location']
            profile.website = u['website']
            profile.save()

            created_users[u['username']] = user
            status_text = 'Created' if created else 'Updated'
            self.stdout.write(f"  {status_text} user: @{user.username} (password: {u['password']})")

        alex = created_users['alex_demo']
        sophia = created_users['sophia_demo']
        david = created_users['david_demo']
        elena = created_users['elena_demo']

        # 2. Follow Relationships
        Follow.objects.get_or_create(follower=alex, following=sophia)
        Follow.objects.get_or_create(follower=alex, following=david)
        Follow.objects.get_or_create(follower=sophia, following=alex)
        Follow.objects.get_or_create(follower=david, following=alex)
        Follow.objects.get_or_create(follower=elena, following=sophia)
        Follow.objects.get_or_create(follower=elena, following=alex)

        # 3. Create Posts
        p1, _ = Post.objects.get_or_create(
            author=alex,
            content="Welcome to Vibely! 🚀 Share. Connect. Discover. We built this platform from scratch with pure Django & modern vanilla JS. What feature are you most excited to see? #vibely #python #webdevelopment",
        )
        p1.extract_hashtags()

        # Poll on Alex's post
        if not hasattr(p1, 'poll'):
            poll = Poll.objects.create(post=p1, question="Which backend framework do you prefer for high-scale apps?")
            opt1 = PollOption.objects.create(poll=poll, text="Django / Python")
            opt2 = PollOption.objects.create(poll=poll, text="Express / Node.js")
            opt3 = PollOption.objects.create(poll=poll, text="FastAPI")
            opt4 = PollOption.objects.create(poll=poll, text="Go / Gin")

            PollVote.objects.get_or_create(poll=poll, poll_option=opt1, user=sophia)
            PollVote.objects.get_or_create(poll=poll, poll_option=opt1, user=david)
            PollVote.objects.get_or_create(poll=poll, poll_option=opt3, user=elena)

        p2, _ = Post.objects.get_or_create(
            author=sophia,
            content="Dark mode is not just inverted colors. It is about contrast, depth hierarchy, and visual comfort during late night coding sessions. 🌙✨ #design #uiux #frontend",
        )
        p2.extract_hashtags()

        p3, _ = Post.objects.get_or_create(
            author=david,
            content="Indexing foreign keys and using select_related() / prefetch_related() in Django ORM cuts query time by 80%. Don't sleep on database optimization! #python #backend #databases",
        )
        p3.extract_hashtags()

        # 4. Likes & Bookmarks
        Like.objects.get_or_create(post=p1, user=sophia)
        Like.objects.get_or_create(post=p1, user=david)
        Like.objects.get_or_create(post=p2, user=alex)
        Bookmark.objects.get_or_create(post=p2, user=alex)

        # 5. Comments & Nested Replies
        c1, _ = Comment.objects.get_or_create(
            post=p1,
            author=sophia,
            parent=None,
            content="The clean typography and responsive layout are stunning! Congratulations on the launch! 🎉",
        )
        # Reply
        Comment.objects.get_or_create(
            post=p1,
            author=alex,
            parent=c1,
            content="Thank you Sophia! Appreciate the feedback!",
        )

        # 6. Notifications
        Notification.objects.get_or_create(
            recipient=alex,
            actor=sophia,
            action_type='like',
            post=p1,
        )
        Notification.objects.get_or_create(
            recipient=alex,
            actor=sophia,
            action_type='comment',
            post=p1,
            comment=c1,
        )
        Notification.objects.get_or_create(
            recipient=alex,
            actor=sophia,
            action_type='follow',
        )

        # 7. Direct Messaging Conversation
        conv = Conversation.get_or_create_between(alex, sophia)
        m1, _ = Message.objects.get_or_create(
            conversation=conv,
            sender=sophia,
            text="Hey Alex! Just saw the new Vibely update. Looks super sleek!",
        )
        m2, _ = Message.objects.get_or_create(
            conversation=conv,
            sender=alex,
            text="Thanks Sophia! Feel free to test the polling, comments, and theme switcher.",
        )

        # 8. Real Moments / Stories (< 24h)
        Story.objects.get_or_create(
            user=sophia,
            caption="Morning coffee & creative design sprints ☕✨ #designlife",
            background_color="linear-gradient(135deg, #FF6B6B, #FF8E72)"
        )
        Story.objects.get_or_create(
            user=alex,
            caption="Shipping the light-first Vibely community experience! 🚀",
            background_color="linear-gradient(135deg, #845EC2, #D65DB1)"
        )
        Story.objects.get_or_create(
            user=elena,
            caption="Reading new papers on generative UI and multimodal agents 📚",
            background_color="linear-gradient(135deg, #00B4D8, #90E0EF)"
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data!'))
        self.stdout.write(self.style.SUCCESS('Primary demo accounts:'))
        self.stdout.write(self.style.SUCCESS('  1. alex_demo   / DemoPassword123!'))
        self.stdout.write(self.style.SUCCESS('  2. sophia_demo / DemoPassword123!'))
