import { useState, useMemo } from 'react'
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
import type { Task, TaskStatus, GatewayConfig } from '../types'
import { TaskCard, DraggableTaskCard } from './TaskCard'
import './KanbanBoard.css'

interface KanbanBoardProps {
  tasks: Task[]
  gateways: GatewayConfig[]
  onUpdateTask: (task: Task) => Promise<void>
  onEditTask: (task: Task) => void
  onCreateTask: () => void
}

interface ColumnConfig {
  id: TaskStatus
  title: string
  color: string
}

const COLUMNS: ColumnConfig[] = [
  { id: 'inbox', title: 'INBOX', color: '#4ecdc4' },
  { id: 'assigned', title: 'ASSIGNED', color: '#a855f7' },
  { id: 'in_progress', title: 'IN PROGRESS', color: '#ffe66d' },
  { id: 'review', title: 'REVIEW', color: '#06b6d4' },
  { id: 'done', title: 'DONE', color: '#00ff9d' }
]

interface KanbanColumnProps {
  column: ColumnConfig
  tasks: Task[]
  gateways: GatewayConfig[]
  onEditTask: (task: Task) => void
}

function KanbanColumn({ column, tasks, gateways, onEditTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  
  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'drag-over' : ''}`}
    >
      <div className="kanban-column-header">
        <span 
          className="kanban-column-indicator"
          style={{ backgroundColor: column.color }}
        />
        <span className="kanban-column-title">{column.title}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      
      <div className="kanban-column-content">
        <SortableContext 
          items={tasks.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              gateways={gateways}
              onClick={() => onEditTask(task)}
            />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="kanban-column-empty">
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({ 
  tasks, 
  gateways, 
  onUpdateTask, 
  onEditTask,
  onCreateTask 
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterAgentId && task.assignedAgentId !== filterAgentId) return false
      if (filterPriority && task.priority !== filterPriority) return false
      return true
    })
  }, [tasks, filterAgentId, filterPriority])

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: []
    }
    
    for (const task of filteredTasks) {
      grouped[task.status].push(task)
    }
    
    // Sort by priority within each column
    const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 }
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        const aPriority = priorityOrder[a.priority || 'undefined']
        const bPriority = priorityOrder[b.priority || 'undefined']
        if (aPriority !== bPriority) return aPriority - bPriority
        return b.createdAt - a.createdAt // Newer first
      })
    }
    
    return grouped
  }, [filteredTasks])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
  }

  const handleDragOver = () => {
    // Could add visual feedback here
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    
    if (!over) return
    
    const taskId = active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    
    // Check if dropped on a column
    const newStatus = over.id as TaskStatus
    if (COLUMNS.some(c => c.id === newStatus) && task.status !== newStatus) {
      await onUpdateTask({
        ...task,
        status: newStatus,
        updatedAt: Date.now()
      })
    }
  }

  const connectedGateways = gateways.filter(g => g.status === 'connected')

  return (
    <div className="kanban-board">
      {/* Filters */}
      <div className="kanban-filters">
        <div className="kanban-filter-group">
          <span className="kanban-filter-label">Agent:</span>
          <select 
            value={filterAgentId || ''}
            onChange={e => setFilterAgentId(e.target.value || null)}
            className="kanban-filter-select"
          >
            <option value="">All</option>
            {connectedGateways.map(g => (
              <option key={g.id} value={g.id}>
                {g.avatar || '🤖'} {g.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="kanban-filter-group">
          <span className="kanban-filter-label">Priority:</span>
          <select 
            value={filterPriority || ''}
            onChange={e => setFilterPriority(e.target.value as Task['priority'] || null)}
            className="kanban-filter-select"
          >
            <option value="">All</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
        
        <div className="kanban-filter-spacer" />
        
        <button className="kanban-add-btn" onClick={onCreateTask}>
          + New Task
        </button>
      </div>
      
      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-columns">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id]}
              gateways={gateways}
              onEditTask={onEditTask}
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeTask && (
            <TaskCard 
              task={activeTask} 
              gateways={gateways}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
