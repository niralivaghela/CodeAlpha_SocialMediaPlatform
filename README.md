# CodeAlpha — Social Media Platform (VIBELY)

> **CodeAlpha Full Stack Development Internship — Task 2 Submission**  
> **Repository**: `CodeAlpha_SocialMediaPlatform`  
> A production-grade, full-featured social media platform engineered with **Django 6**, **Django REST Framework**, and **Vanilla HTML5, CSS3, and JavaScript**. Built with 100% real database-backed interactions — **zero fabricated metrics, likes, followers, or chat**.

---

## 🌟 Overview & Key Highlights

**Vibely** is an authentic, modern social media platform designed with an original visual identity (indigo/violet accents with cyan highlights). It delivers rich micro-interactions, responsive design across desktop and mobile, nested comments, live poll tallies, real-time message synchronization, and accessible theme switching.

- **100% Real Database Interactions**: Every follower count, like count, comment thread, vote percentage, and notification is grounded in SQLite database models (easily swappable with PostgreSQL).
- **Zero Framework Bloat**: Pure HTML5, CSS3 variables, and vanilla ES6+ JavaScript without React or heavyweight frontend frameworks.
- **Light / Dark / System Theme**: Built-in CSS custom variable tokens with persistence in `localStorage` and automatic OS preference syncing (`prefers-color-scheme`).
- **Real-Time Experience**: High-efficiency, debounced 4-second REST polling engine for direct messaging and unread notification badges.
- **Security-First Architecture**: Session-based authentication with CSRF cookie tokens (`X-CSRFToken`), ownership enforcement for editing/deleting, password strength validation, and secure media size/format checks.

---

## 🛠 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.14, Django 6.1.1, Django REST Framework 3.18.1, django-cors-headers, Pillow |
| **Frontend** | HTML5, CSS3 (Modern Flexbox/Grid, CSS Custom Properties), Vanilla JavaScript (ES6+) |
| **Database** | SQLite (configured for straightforward migration to PostgreSQL) |
| **Security** | Django Session Auth, PBKDF2 Password Hashing, CSRF Cookie Protection, Ownership RBAC |

---

## 📁 Project Architecture

```
vibely/
├── backend/
│   ├── manage.py
│   ├── config/              # Core Django settings, URLs, WSGI
│   ├── accounts/            # Profile, initials generator, presence tracking, seed command
│   ├── posts/               # Posts, media, hashtags, polls, voting, likes, bookmarks
│   ├── comments/            # Comments & recursive nested replies
│   ├── social/              # Follows, blocks, content reporting
│   ├── notifications/       # Real notifications (follow, like, comment, reply)
│   ├── messaging/           # Direct conversations & message threads
│   ├── api/                 # DRF serializers, views, permissions, test suite
│   └── verify_two_users.py  # End-to-end multi-user integration test runner
├── frontend/
│   ├── index.html           # Landing / Hero page
│   ├── login.html           # Login screen with demo quick-fill
│   ├── register.html        # Registration with password strength meter
│   ├── feed.html            # 3-column feed, post composer, trending, suggested users
│   ├── profile.html         # User profile, initials avatar, stats, posts/likes tabs
│   ├── explore.html         # Categorized search (people, posts, tags) & trending
│   ├── messages.html        # Direct chat dual-pane interface
│   ├── notifications.html   # Notifications list with mark as read
│   ├── settings.html        # Appearance, privacy, blocked users manager
│   ├── css/
│   │   ├── variables.css    # Light/Dark/System theme CSS design tokens
│   │   ├── main.css         # Reset, typography, buttons, inputs, toasts, avatars
│   │   ├── components.css   # Post cards, composer, comments, polls, modals, nav
│   │   └── pages.css        # Page-specific responsive styles
│   └── js/
│       ├── api.js           # Centralized API fetch client with CSRF token injection
│       ├── theme.js         # Theme bootstrapper (light/dark/system)
│       ├── auth.js          # Authentication handlers & password strength meter
│       ├── nav.js           # Session guard & badge polling
│       ├── composer.js      # Post creation, media preview, poll builder
│       ├── feed.js          # Post rendering, likes, bookmarks, poll voting, dropdowns
│       ├── comments.js      # In-card comments & nested replies
│       ├── profile.js       # Profile rendering, follow toggle, edit modal
│       ├── explore.js       # Debounced search & hashtag feeds
│       ├── messages.js      # Dual-pane messenger with 4s polling sync
│       ├── notifications.js # Real-time notification listing & mark-read
│       └── settings.js      # Privacy toggle, theme selector, blocked users list
├── media/                   # Uploaded avatars and post media
├── static/                  # Shared static assets
├── requirements.txt         # Project dependencies
├── .env.example             # Configuration variables template
└── README.md                # Documentation & evaluation instructions
```

---

## 🗄 Database Models & Entity Relationships

- **User & Profile** (`accounts`):
  - `Profile` (OneToOne with User): `bio`, `avatar`, `location`, `website`, `is_private`, `last_seen`.
  - Properties: `initials` (deterministic initials, e.g. "NV" for Nirali Vaghela), `presence_status` (`online` if active within 3 minutes, `away`, `offline`).
- **Post & Media** (`posts`):
  - `Post`: `author`, `content`, `image`, `is_edited`, `created_at`.
  - `Hashtag` & `PostHashtag`: Automatic `#hashtag` extraction and indexing.
  - `Poll`, `PollOption`, `PollVote`: One vote per user constraint with real percentage calculations.
  - `Like` & `Bookmark`: Unique database constraints `(post, user)` preventing duplicate actions.
- **Comment** (`comments`):
  - `Comment`: `post`, `author`, `parent` (FK to self for infinite or multi-level nested replies), `content`.
- **Social** (`social`):
  - `Follow`: Unique constraint `(follower, following)`, Check constraint preventing self-follow.
  - `Block`: Removes mutual follows, hides posts from blocker's feed, and prevents direct messaging.
  - `Report`: Records content reports with categorized reasons (`spam`, `harassment`, `inappropriate`, etc.).
- **Notification** (`notifications`):
  - `Notification`: Tracks `action_type` (`like`, `comment`, `reply`, `follow`), `actor`, `recipient`, `post`, `is_read`.
- **Messaging** (`messaging`):
  - `Conversation`: Normalized user pair (`user1.id < user2.id`) for unique thread per pair.
  - `Message`: `conversation`, `sender`, `text`, `is_read`, `created_at`.

---

## 🔌 Core REST API Endpoints

### Authentication
- `POST /api/auth/register/`: Full validation, password strength verification, auto session login.
- `POST /api/auth/login/`: Username or email authentication.
- `POST /api/auth/logout/`: Clears user session.
- `GET /api/auth/me/`: Current profile, presence status, and unread notification/message counts.

### Posts & Interactions
- `GET /api/posts/?filter=for_you|following`: Smart feed prioritizing followed creators and recency.
- `POST /api/posts/`: Creates post with optional photo (max 10MB) and optional interactive poll.
- `GET|PATCH|DELETE /api/posts/:id/`: View, edit (author only), or delete post.
- `POST /api/posts/:id/like/`: Toggles like and creates notification.
- `POST /api/posts/:id/bookmark/`: Toggles bookmark state.
- `POST /api/posts/:id/vote/`: Casts a single vote in a poll.

### Comments
- `GET /api/posts/:id/comments/`: Returns hierarchical comments with nested replies.
- `POST /api/posts/:id/comments/`: Posts top-level comment or reply (`parent_id`).
- `DELETE /api/comments/:id/`: Author-only deletion.

### Social & Moderation
- `GET /api/users/:username/`: Public profile, presence status, stats, and follow status.
- `POST /api/users/:username/follow/`: Follow/unfollow toggle.
- `GET /api/users/:username/followers/`: Actual followers list.
- `GET /api/users/:username/following/`: Actual followed accounts list.
- `POST /api/users/:username/block/`: Blocks or unblocks user.
- `GET /api/users/suggested/`: Smart suggestions based on popularity and mutual followings.
- `POST /api/reports/`: File moderation report.

### Explore & Search
- `GET /api/explore/trending/`: Top hashtags sorted by real post frequency.
- `GET /api/explore/popular/`: Top posts ranked by engagement (likes + comments).
- `GET /api/explore/tags/:name/`: Posts tagged with a specific hashtag.
- `GET /api/search/?q=:query`: Debounced categorized search (People, Posts, Hashtags).

### Direct Messaging & Notifications
- `GET /api/conversations/`: Active conversations with other participant's presence dot and unread badge.
- `POST /api/conversations/start/`: Initiates conversation with target username.
- `GET|POST /api/conversations/:id/messages/`: Paginated messages and sending.
- `GET /api/notifications/`: Paginated notification stream.
- `PATCH /api/notifications/:id/read/`: Mark individual notification read.
- `POST /api/notifications/read-all/`: Mark all notifications as read.

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Pip

### 2. Clone / Navigate to Project Directory
```powershell
cd C:\Users\hp\.gemini\antigravity\scratch\vibely
```

### 3. Install Dependencies
```powershell
python -m pip install -r requirements.txt
```

### 4. Apply Database Migrations
```powershell
python backend/manage.py migrate
```

### 5. Seed Realistic Demo Accounts (Optional but Recommended)
```powershell
python backend/manage.py seed_demo
```
This provisions two primary test accounts:
- **Alex Rivera**: `alex_demo` / `DemoPassword123!` (Engineer persona)
- **Sophia Chen**: `sophia_demo` / `DemoPassword123!` (Designer persona)
- Along with posts, polls, comments, likes, and follow relationships.

### 6. Create Superuser (Optional for Django Admin)
```powershell
python backend/manage.py createsuperuser
```

### 7. Run Development Server
```powershell
python backend/manage.py runserver 127.0.0.1:8000
```

### 8. Access the Application
Open your browser and navigate to:
```
http://127.0.0.1:8000/
```
- **Landing Page**: `http://127.0.0.1:8000/index.html`
- **Login**: `http://127.0.0.1:8000/login.html` (Use quick-fill buttons for instant evaluation)
- **Home Feed**: `http://127.0.0.1:8000/feed.html`
- **Django Admin**: `http://127.0.0.1:8000/admin/`

---

## 🧪 Verification & Testing

### Automated Test Suite
Run the 9 backend unit & integration tests:
```powershell
python backend/manage.py test api
```
Output:
```
Ran 9 tests in 11.647s
OK
```

### Automated Two-User Flow Verification
Run the 11-step end-to-end multi-user integration test:
```powershell
python backend/verify_two_users.py
```
Output:
```
=================================================================
VIBELY REAL-WORLD TWO-USER FLOW VERIFICATION
=================================================================
[Step 1] Logging in User A (alex_demo)...
  ✓ User A logged in: @alex_demo (Alex Rivera)
[Step 2] Logging in User B (sophia_demo)...
  ✓ User B logged in: @sophia_demo (Sophia Chen)
[Step 3] User A creates post with poll and hashtag...
  ✓ Post #4 created with poll #2
[Step 4] User B fetches feed and finds User A's post...
  ✓ User B sees post #4 in feed
[Step 5] User B votes on Option 1 in the poll...
  ✓ Vote registered. Poll total votes: 1
[Step 6] User B likes User A's post...
  ✓ User B liked post. Like count is now: 1
[Step 7] User A checks notifications for like event...
  ✓ User A received notification: @sophia_demo liked post #4
[Step 8] User B leaves a comment on User A's post...
  ✓ Comment #3 posted by User B
[Step 9] User A checks comment notification and posts nested reply...
  ✓ User A received notification for comment
  ✓ User A posted nested reply
[Step 10] Checking Follow / Following relationships...
  ✓ Follow state toggled: is_following=True
[Step 11] Direct messaging between User A and User B...
  ✓ Message sent by User A to User B
  ✓ User B received message
=================================================================
SUCCESS: ALL 11 MULTI-USER REAL-WORLD VERIFICATION STEPS PASSED!
=================================================================
```

---

## 🔒 Security & Integrity Measures

1. **Authentication & Password Protection**: Passwords are never stored in plaintext and are hashed using Django's default PBKDF2 SHA-256 algorithm with work factor salts.
2. **CSRF Defense**: All mutating requests (POST, PATCH, DELETE) require the `X-CSRFToken` header extracted from the HTTP-level cookie.
3. **Data Integrity**: Database constraints (`unique_together`) prevent double-likes, double-bookmarks, double-votes, and duplicate follows. Self-follow and self-block are rejected at the model validation level.
4. **Ownership Authorization**: A user cannot edit or delete another user's post, delete another user's comment, or view messages from conversations they are not part of.
5. **Media Sanitization**: Uploaded avatars and post media are validated for extension whitelist (`.jpg`, `.png`, `.webp`, `.gif`) and size limits (5MB for avatars, 10MB for posts).

---

## 💡 Future Enhancements
- WebSockets via Django Channels for sub-second messaging (requires Redis).
- Video transcoding with FFmpeg.
- 24-hour expiring Stories feature.
- Multi-factor authentication (MFA).

---

**Built with passion for Task 2 Social Media Platform Submission.**
