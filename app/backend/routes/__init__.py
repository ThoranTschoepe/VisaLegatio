# backend/routes/__init__.py - Route module initializer

# This file makes the routes directory a Python package
# Import all route modules here for easy access

from . import applications
from . import chat
from . import officers
from . import analytics
from . import documents
from . import bias_review
from . import bias_monitoring
from . import review_audit

__all__ = [
    "applications",
    "chat",
    "officers",
    "analytics",
    "documents",
    "bias_review",
    "bias_monitoring",
    "review_audit",
]
