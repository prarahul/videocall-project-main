import React, { useState, useEffect } from 'react';

const NotesModal = ({ isOpen, onClose, socket, currentMeetingId, user }) => {
  const [notes, setNotes] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for notes events
    socket.on("notes-updated", (data) => {
      console.log(`📝 Notes updated by ${data.userName}`);
      setSaving(false);
      setLastSaved(new Date());
    });

    socket.on("notes-shared", (data) => {
      setNotes(data.notes);
      alert(`📝 ${data.sharedBy} shared meeting notes with everyone`);
    });

    return () => {
      socket.off("notes-updated");
      socket.off("notes-shared");
    };
  }, [socket]);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    setSaving(true);
    
    // Auto-save notes with debouncing
    clearTimeout(window.notesTimeout);
    window.notesTimeout = setTimeout(() => {
      if (currentMeetingId && socket) {
        socket.emit("update-notes", {
          roomId: currentMeetingId,
          notes: e.target.value,
          userId: user._id,
          userName: user?.username
        });
      } else {
        console.log("Notes updated locally:", e.target.value);
        setSaving(false);
        setLastSaved(new Date());
      }
    }, 1000);
  };

  const shareNotes = () => {
    if (currentMeetingId && socket) {
      socket.emit("share-notes", {
        roomId: currentMeetingId,
        notes: notes,
        sharedBy: user?.username
      });
      alert('Notes shared with all participants!');
    } else {
      console.log("Notes saved locally (no active meeting):", notes);
      alert('📝 Notes saved locally!');
    }
  };

  const downloadNotes = () => {
    if (!notes.trim()) {
      alert('No notes to download');
      return;
    }
    
    const blob = new Blob([notes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearNotes = () => {
    if (notes.trim() && !confirm('Are you sure you want to clear all notes?')) {
      return;
    }
    setNotes('');
    setLastSaved(null);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 99998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-6" style={{ maxHeight: '80vh', height: '600px' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            📝 Meeting Notes
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-3xl font-light"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col h-full">
          {/* Status Bar */}
          <div className="flex justify-between items-center mb-4 p-2 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              {saving ? (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </span>
              ) : lastSaved ? (
                <span>Last saved: {formatTime(lastSaved)}</span>
              ) : (
                <span>Ready to take notes</span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {notes.length} characters
            </div>
          </div>

          {/* Notes Editor */}
          <div className="flex-1 mb-4">
            <textarea 
              className="w-full h-full p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Start taking notes for your meeting...

You can use this space to:
• Capture key discussion points
• Track action items and decisions
• Note important dates and follow-ups
• Share important links or references

Your notes will auto-save as you type and can be shared with all meeting participants."
              value={notes}
              onChange={handleNotesChange}
              style={{ fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5' }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={shareNotes}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center gap-2"
            >
              <span>📤</span>
              Share with Participants
            </button>
            
            <button 
              onClick={downloadNotes}
              disabled={!notes.trim()}
              className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>💾</span>
              Download Notes
            </button>
            
            <button 
              onClick={clearNotes}
              disabled={!notes.trim()}
              className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>🗑️</span>
              Clear All
            </button>
            
            <button 
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>

          {/* Quick Tips */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>💡 Tips:</strong> Notes auto-save every second. Use "Share" to send your notes to all participants. 
              Press Ctrl+A to select all text, or Ctrl+Z to undo changes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;