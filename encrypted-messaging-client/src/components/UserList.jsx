export default function UserList({ users, selectedUser, onSelectUser, currentUserId }) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Users</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {users
          .filter((user) => user.id !== currentUserId)
          .map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                selectedUser?.id === user.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
              }`}
            >
              <div className="font-medium text-gray-900">{user.username}</div>
            </button>
          ))}
      </div>
    </div>
  );
}
