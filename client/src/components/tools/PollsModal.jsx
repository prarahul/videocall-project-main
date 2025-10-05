import React, { useState, useEffect } from 'react';

const PollsModal = ({ isOpen, onClose, socket, currentMeetingId, user }) => {
  const [polls, setPolls] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '']);

  useEffect(() => {
    if (!socket) return;

    // Listen for poll events
    socket.on("poll-created", (data) => {
      setPolls(prev => [...prev, data.poll]);
      console.log(`📊 New poll created: ${data.poll.question}`);
    });

    socket.on("poll-voted", (data) => {
      setPolls(prev => prev.map(poll => 
        poll.id === data.pollId 
          ? { ...poll, votes: { ...poll.votes, [data.userId]: data.optionIndex } }
          : poll
      ));
    });

    return () => {
      socket.off("poll-created");
      socket.off("poll-voted");
    };
  }, [socket]);

  const createPoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.filter(opt => opt.trim());
    
    if (question && options.length >= 2) {
      const newPoll = {
        id: Date.now(),
        question,
        options,
        votes: {},
        createdBy: user?.username,
        createdAt: Date.now()
      };
      
      setPolls(prev => [...prev, newPoll]);
      
      // Broadcast poll to other participants
      if (currentMeetingId && socket) {
        socket.emit("create-poll", {
          roomId: currentMeetingId,
          poll: newPoll
        });
      } else {
        console.log("Poll created locally (no active meeting):", newPoll);
      }
      
      // Reset form
      setPollQuestion('');
      setPollOptions(['', '', '']);
      alert('Poll created successfully!');
    } else {
      alert('Please fill in the question and at least 2 options');
    }
  };

  const voteOnPoll = (pollId, optionIndex) => {
    if (currentMeetingId && socket) {
      socket.emit("vote-poll", {
        roomId: currentMeetingId,
        pollId: pollId,
        optionIndex: optionIndex,
        userId: user._id
      });
    }
    
    // Update local state
    setPolls(prev => prev.map(poll => 
      poll.id === pollId 
        ? { ...poll, votes: { ...poll.votes, [user._id]: optionIndex } }
        : poll
    ));
  };

  const calculateResults = (poll) => {
    const totalVotes = Object.keys(poll.votes).length;
    return poll.options.map((option, index) => {
      const votes = Object.values(poll.votes).filter(vote => vote === index).length;
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      return { option, votes, percentage };
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }} 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        maxWidth: '600px',
        width: '100%',
        padding: '30px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            📊 Polls
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-3xl font-light"
          >
            ×
          </button>
        </div>

        {/* Create New Poll Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-3">Create New Poll</h4>
          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="Enter your poll question..." 
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pollOptions.map((option, index) => (
              <input 
                key={index}
                type="text" 
                placeholder={`Option ${index + 1}${index < 2 ? ' (required)' : ' (optional)'}`} 
                value={option}
                onChange={(e) => {
                  const newOptions = [...pollOptions];
                  newOptions[index] = e.target.value;
                  setPollOptions(newOptions);
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}
            <div className="flex gap-3">
              <button 
                onClick={createPoll}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
              >
                Create Poll
              </button>
              <button 
                onClick={() => {
                  setPollQuestion('');
                  setPollOptions(['', '', '']);
                }}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        
        {/* Active Polls */}
        {polls.length > 0 && (
          <div>
            <h4 className="font-semibold mb-4">Active Polls ({polls.length})</h4>
            <div className="space-y-4">
              {polls.map(poll => {
                const results = calculateResults(poll);
                const hasVoted = poll.votes[user._id] !== undefined;
                
                return (
                  <div key={poll.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-medium text-lg mb-3">{poll.question}</div>
                    <div className="text-sm text-gray-500 mb-3">
                      Created by {poll.createdBy} • {Object.keys(poll.votes).length} votes
                    </div>
                    
                    <div className="space-y-2">
                      {results.map((result, idx) => (
                        <div key={idx} className="relative">
                          <button 
                            onClick={() => !hasVoted && voteOnPoll(poll.id, idx)}
                            disabled={hasVoted}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              hasVoted 
                                ? poll.votes[user._id] === idx 
                                  ? 'bg-blue-100 border-blue-300' 
                                  : 'bg-gray-50 border-gray-200'
                                : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{result.option}</span>
                              {hasVoted && (
                                <span className="text-sm text-gray-600">
                                  {result.votes} votes ({result.percentage}%)
                                </span>
                              )}
                            </div>
                            {hasVoted && (
                              <div className="mt-2 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${result.percentage}%` }}
                                ></div>
                              </div>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {hasVoted && (
                      <div className="mt-3 text-sm text-green-600 font-medium">
                        ✓ You voted for: {poll.options[poll.votes[user._id]]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {polls.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <div>No polls created yet. Create your first poll above!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollsModal;