import React, { useState, useEffect, useRef } from 'react';

const WhiteboardModal = ({ isOpen, onClose, socket, currentMeetingId, user }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(3);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!socket) return;

    socket.on("whiteboard-drawing", (data) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const { fromX, fromY, toX, toY, color, size } = data.drawing;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });

    socket.on("whiteboard-cleared", () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    return () => {
      socket.off("whiteboard-drawing");
      socket.off("whiteboard-cleared");
    };
  }, [socket]);

  const startDrawing = (e) => {
    if (currentTool === 'pen') {
      setIsDrawing(true);
      const rect = canvasRef.current.getBoundingClientRect();
      setLastPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const draw = (e) => {
    if (!isDrawing || currentTool !== 'pen') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const currentPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Broadcast drawing to other participants
    if (currentMeetingId && socket) {
      socket.emit("whiteboard-draw", {
        roomId: currentMeetingId,
        drawing: {
          fromX: lastPos.x,
          fromY: lastPos.y,
          toX: currentPos.x,
          toY: currentPos.y,
          color: currentColor,
          size: currentSize
        }
      });
    }

    setLastPos(currentPos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (currentMeetingId && socket) {
        socket.emit("whiteboard-clear", {
          roomId: currentMeetingId
        });
      }
    }
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
      zIndex: 99997,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        maxWidth: '90vw',
        width: '800px',
        height: '600px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            🎨 Whiteboard
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-3xl font-light"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Tool:</label>
            <select 
              value={currentTool} 
              onChange={(e) => setCurrentTool(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              <option value="pen">✏️ Pen</option>
              <option value="eraser">🧽 Eraser</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Color:</label>
            <input 
              type="color" 
              value={currentColor} 
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-300"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Size:</label>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={currentSize} 
              onChange={(e) => setCurrentSize(parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-sm w-6">{currentSize}</span>
          </div>
          
          <button 
            onClick={clearWhiteboard}
            className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition-colors"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            id="whiteboard"
            width={760}
            height={400}
            style={{
              cursor: currentTool === 'pen' ? 'crosshair' : 'grab',
              background: 'white',
              width: '100%',
              height: '100%'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          💡 Draw on the canvas above. Your drawings will be shared with all participants in real-time.
        </div>
      </div>
    </div>
  );
};

export default WhiteboardModal;