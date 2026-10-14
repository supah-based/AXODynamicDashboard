ALTER TABLE axo_stream_workspaces
 DROP CONSTRAINT axo_stream_workspaces_shortcuts_check,
 ADD CONSTRAINT axo_stream_workspaces_shortcuts_check
 CHECK (jsonb_typeof(shortcuts)='array');
