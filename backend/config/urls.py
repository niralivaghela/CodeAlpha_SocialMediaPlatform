import mimetypes
mimetypes.add_type("text/css", ".css", True)
mimetypes.add_type("application/javascript", ".js", True)
mimetypes.add_type("image/svg+xml", ".svg", True)
mimetypes.add_type("font/woff2", ".woff2", True)

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404

def serve_frontend_asset(request, path):
    frontend_dir = settings.PROJECT_ROOT / 'frontend'
    filepath = (frontend_dir / path).resolve()
    # Security check: prevent directory traversal
    if not str(filepath).startswith(str(frontend_dir)):
        raise Http404("Access denied")
    if filepath.exists() and filepath.is_file():
        content_type, _ = mimetypes.guess_type(str(filepath))
        return FileResponse(open(filepath, 'rb'), content_type=content_type or 'application/octet-stream')
    raise Http404("Asset not found")

def serve_frontend(request, page='index.html'):
    if not page or page == '':
        page = 'index.html'

    frontend_dir = settings.PROJECT_ROOT / 'frontend'
    
    # Direct match
    filepath = (frontend_dir / page).resolve()
    if str(filepath).startswith(str(frontend_dir)) and filepath.exists() and filepath.is_file():
        content_type, _ = mimetypes.guess_type(str(filepath))
        return FileResponse(open(filepath, 'rb'), content_type=content_type or 'text/html')

    # If accessed without .html suffix (e.g. /feed, /profile, /explore)
    html_filepath = (frontend_dir / f"{page}.html").resolve()
    if str(html_filepath).startswith(str(frontend_dir)) and html_filepath.exists() and html_filepath.is_file():
        return FileResponse(open(html_filepath, 'rb'), content_type='text/html')

    raise Http404("Page not found")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),

    # Frontend assets (css, js, assets)
    re_path(r'^(?P<path>(css|js|assets)/.+)$', serve_frontend_asset, name='frontend-assets'),

    # Frontend HTML routes
    path('', serve_frontend, kwargs={'page': 'index.html'}, name='frontend-home'),
    re_path(r'^(?P<page>[a-zA-Z0-9_\-\./]+\.html)$', serve_frontend, name='frontend-html'),
    re_path(r'^(?P<page>[a-zA-Z0-9_\-]+)/?$', serve_frontend, name='frontend-page'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.PROJECT_ROOT / 'frontend')

