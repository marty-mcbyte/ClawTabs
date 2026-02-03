import { useState, useMemo } from 'react'
import type { Task, GatewayConfig, ActivityEvent, TaskStatus } from '../types'
import { DraggableTaskCard, TaskCard } from './TaskCard'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import './MissionControl.css'

interface MissionControlProps {
  tasks: Task[]
  gateways: GatewayConfig[]
  events: ActivityEvent[]
  onUpdateTask: (task: Task) => Promise<void>
  onEditTask: (task: Task) => void
  onCreateTask: () => void
  onSelectAgent: (id: string | null) => void
  selectedAgentId: string | null
}

interface ColumnConfig {
  id: TaskStatus
  title: string
  color: string
  shortcut: string
}

const COLUMNS: ColumnConfig[] = [
  { id: 'inbox', title: 'INBOX', color: '#4ecdc4', shortcut: '1' },
  { id: 'assigned', title: 'ASSIGNED', color: '#a855f7', shortcut: '2' },
  { id: 'in_progress', title: 'ACTIVE', color: '#ffe66d', shortcut: '3' },
  { id: 'review', title: 'REVIEW', color: '#06b6d4', shortcut: '4' },
  { id: 'done', title: 'DONE', color: '#00ff9d', shortcut: '5' }
]

function MiniColumn({ 
  column, 
  tasks, 
  gateways, 
  onEditTask 
}: { 
  column: ColumnConfig
  tasks: Task[]
  gateways: GatewayConfig[]
  onEditTask: (task: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  
  return (
    <div 
      ref={setNodeRef}
      className={`mc-column ${isOver ? 'drag-over' : ''}`}
    >
      <div className="mc-column-header">
        <span className="mc-column-dot" style={{ backgroundColor: column.color }} />
        <span className="mc-column-title">{column.title}</span>
        <span className="mc-column-count">{tasks.length}</span>
        <span className="mc-column-shortcut">{column.shortcut}</span>
      </div>
      <div className="mc-column-tasks">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.slice(0, 5).map(task => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              gateways={gateways}
              onClick={() => onEditTask(task)}
            />
          ))}
        </SortableContext>
        {tasks.length > 5 && (
          <div className="mc-column-more">+{tasks.length - 5} more</div>
        )}
        {tasks.length === 0 && (
          <div className="mc-column-empty">Empty</div>
        )}
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

export function MissionControl({
  tasks,
  gateways,
  events,
  onUpdateTask,
  onEditTask,
  onCreateTask,
  onSelectAgent,
  selectedAgentId
}: MissionControlProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Filter tasks by selected agent
  const filteredTasks = useMemo(() => {
    if (!selectedAgentId) return tasks
    return tasks.filter(t => t.assignedAgentId === selectedAgentId)
  }, [tasks, selectedAgentId])

  // Group by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      inbox: [], assigned: [], in_progress: [], review: [], done: []
    }
    for (const task of filteredTasks) {
      grouped[task.status].push(task)
    }
    return grouped
  }, [filteredTasks])

  // Count tasks per agent
  const taskCountByAgent = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const task of tasks) {
      if (task.assignedAgentId && task.status !== 'done') {
        counts[task.assignedAgentId] = (counts[task.assignedAgentId] || 0) + 1
      }
    }
    return counts
  }, [tasks])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    
    const newStatus = over.id as TaskStatus
    if (COLUMNS.some(c => c.id === newStatus) && task.status !== newStatus) {
      await onUpdateTask({ ...task, status: newStatus, updatedAt: Date.now() })
    }
  }

  const connectedGateways = gateways.filter(g => g.status === 'connected')
  const activeCount = connectedGateways.length
  const totalTasks = tasks.filter(t => t.status !== 'done').length

  return (
    <div className="mission-control">
      {/* Header */}
      <div className="mc-header">
        <div className="mc-header-title">
          <span className="mc-logo">◉</span>
          MISSION CONTROL
        </div>
        <div className="mc-header-stats">
          <span className="mc-stat">
            <span className="mc-stat-value">{activeCount}</span>
            <span className="mc-stat-label">ACTIVE</span>
          </span>
          <span className="mc-stat-divider">•</span>
          <span className="mc-stat">
            <span className="mc-stat-value">{totalTasks}</span>
            <span className="mc-stat-label">TASKS</span>
          </span>
        </div>
        <button className="mc-new-task" onClick={onCreateTask}>
          + NEW TASK
        </button>
      </div>

      {/* Main 3-panel layout */}
      <div className="mc-panels">
        {/* Left: Agents */}
        <div className="mc-agents">
          <div className="mc-panel-title">AGENTS</div>
          <div 
            className={`mc-agent-item ${selectedAgentId === null ? 'active' : ''}`}
            onClick={() => onSelectAgent(null)}
          >
            <span className="mc-agent-avatar">∀</span>
            <div className="mc-agent-info">
              <span className="mc-agent-name">All Agents</span>
              <span className="mc-agent-tasks">{totalTasks} tasks</span>
            </div>
          </div>
          {connectedGateways.map(gateway => {
            const count = taskCountByAgent[gateway.id] || 0
            const isWorking = tasks.some(t => t.assignedAgentId === gateway.id && t.status === 'in_progress')
            
            return (
              <div 
                key={gateway.id}
                className={`mc-agent-item ${selectedAgentId === gateway.id ? 'active' : ''}`}
                onClick={() => onSelectAgent(gateway.id)}
              >
                <span className="mc-agent-avatar">{gateway.avatar || '🤖'}</span>
                <div className="mc-agent-info">
                  <span className="mc-agent-name">{gateway.name}</span>
                  <span className={`mc-agent-status ${isWorking ? 'working' : 'standby'}`}>
                    {isWorking ? '● WORKING' : '○ STANDBY'}
                  </span>
                </div>
                {count > 0 && <span className="mc-agent-badge">{count}</span>}
              </div>
            )
          })}
        </div>

        {/* Center: Kanban */}
        <div className="mc-kanban">
          <div className="mc-panel-title">MISSION QUEUE</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="mc-columns">
              {COLUMNS.map(col => (
                <MiniColumn
                  key={col.id}
                  column={col}
                  tasks={tasksByStatus[col.id]}
                  gateways={gateways}
                  onEditTask={onEditTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} gateways={gateways} isDragging />}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Right: Live Feed */}
        <div className="mc-feed">
          <div className="mc-panel-title">LIVE FEED</div>
          <div className="mc-feed-list">
            {events.slice(0, 20).map(event => {
              const gateway = gateways.find(g => g.id === event.agentId)
              return (
                <div key={event.id} className="mc-feed-item">
                  <span className="mc-feed-avatar">{gateway?.avatar || '🤖'}</span>
                  <div className="mc-feed-content">
                    <span className="mc-feed-agent">{event.agentName}</span>
                    <span className="mc-feed-summary">{event.summary}</span>
                  </div>
                  <span className="mc-feed-time">{formatTime(event.timestamp)}</span>
                </div>
              )
            })}
            {events.length === 0 && (
              <div className="mc-feed-empty">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mc-footer">
        <span className="mc-hint">Press 1-5 to move selected task • Ctrl+T new task • Ctrl+M exit</span>
      </div>
    </div>
  )
}
