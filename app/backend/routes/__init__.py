# backend/routes/__init__.py - Route module initializer

# This file makes the routes directory a Python package
# Import all route modules here for easy access

from . import applications
from . import chat
from . import officers
from . import analytics
from . import documents

__all__ = ["applications", "chat", "officers", "analytics", "documents"]