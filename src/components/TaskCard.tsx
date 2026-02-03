import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, GatewayConfig } from '../types'
import './TaskCard.css'

interface TaskCardProps {
  task: Task
  gateways: GatewayConfig[]
  onClick?: () => void
  isDragging?: boolean
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function getPriorityColor(priority?: Task['priority']): string {
  switch (priority) {
    case 'high': return '#ff6b6b'
    case 'medium': return '#ffe66d'
    case 'low': return '#4ecdc4'
    default: return 'var(--text-dim)'
  }
}

export function TaskCard({ task, gateways, onClick, isDragging }: TaskCardProps) {
  const assignedAgent = task.assignedAgentId 
    ? gateways.find(g => g.id === task.assignedAgentId)
    : null

  return (
    <div 
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
    >
      {/* Priority indicator */}
      <div 
        className="task-card-priority" 
        style={{ backgroundColor: getPriorityColor(task.priority) }}
      />
      
      <div className="task-card-content">
        {/* Header: Title + Agent */}
        <div className="task-card-header">
          <span className="task-card-title">{task.title}</span>
          {assignedAgent && (
            <span className="task-card-agent" title={assignedAgent.name}>
              {assignedAgent.avatar || assignedAgent.name.charAt(0)}
            </span>
          )}
        </div>
        
        {/* Description preview */}
        {task.description && (
          <div className="task-card-desc">{task.description}</div>
        )}
        
        {/* Footer: Tags + Time */}
        <div className="task-card-footer">
          <div className="task-card-tags">
            {task.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="task-card-tag">{tag}</span>
            ))}
            {task.tags && task.tags.length > 2 && (
              <span className="task-card-tag-more">+{task.tags.length - 2}</span>
            )}
          </div>
          <span className="task-card-time">{formatTimeAgo(task.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// Draggable version of TaskCard
export function DraggableTaskCard({ task, gateways, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard 
        task={task} 
        gateways={gateways} 
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  )
}
