# Hybrid Training Tracker V3.0.0

Start with START-HERE.md for database setup, your private tracker login, upload instructions, and verification.

This update retains the complete V2 program and local backups, adds optional Supabase sign-in, separate account caches, automatic sync while open, and explicit conflict resolution.

Deployment requires running supabase-setup.sql in your project first. The SQL and live sync have not yet been validated against your project. Do not rely on cloud storage alone until the documented verification steps pass.

The website uses a public publishable key, not an administrator secret. Do not upload personal backup JSON files to the public GitHub repository.
