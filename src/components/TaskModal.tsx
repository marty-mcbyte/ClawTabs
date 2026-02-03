import { useState, useEffect } from 'react'
import type { Task, GatewayConfig, TaskPriority } from '../types'
import { generateId } from '../store/db'
import './TaskModal.css'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateTask: (task: Task) => Promise<void>
  onUpdateTask?: (task: Task) => Promise<void>
  onDeleteTask?: (id: string) => Promise<void>
  editingTask?: Task | null
  gateways: GatewayConfig[]
  defaultSource?: { type: 'channel' | 'session' | 'manual'; id: string; name: string }
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#4ecdc4' },
  { value: 'medium', label: 'Medium', color: '#ffe66d' },
  { value: 'high', label: 'High', color: '#ff6b6b' }
]

const COMMON_TAGS = ['urgent', 'code', 'research', 'content', 'review', 'bug', 'feature']

export function TaskModal({
  isOpen,
  onClose,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  editingTask,
  gateways,
  defaultSource
}: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form when modal opens/closes or editing task changes
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title)
        setDescription(editingTask.description || '')
        setPriority(editingTask.priority || 'medium')
        setAssignedAgentId(editingTask.assignedAgentId || '')
        setTags(editingTask.tags || [])
      } else {
        setTitle('')
        setDescription('')
        setPriority('medium')
        setAssignedAgentId('')
        setTags([])
      }
      setTagInput('')
    }
  }, [isOpen, editingTask])

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)

    // New tasks always start in INBOX - assignment is just metadata about who should work on it
    // Status changes via drag-drop or agent picking up the task
    const hasAssignment = assignedAgentId && assignedAgentId.length > 0
    const taskStatus = editingTask?.status || 'inbox'
    
    console.log('[TaskModal] Creating task:', { 
      title: title.trim(), 
      assignedAgentId, 
      hasAssignment, 
      taskStatus 
    })

    try {
      const task: Task = {
        id: editingTask?.id || generateId(),
        title: title.trim(),
        description: description.trim() || undefined,
        status: taskStatus,
        assignedAgentId: hasAssignment ? assignedAgentId : undefined,
        createdAt: editingTask?.createdAt || Date.now(),
        updatedAt: Date.now(),
        source: editingTask?.source || defaultSource || { type: 'manual', id: '', name: 'Manual' },
        tags: tags.length > 0 ? tags : undefined,
        priority
      }

      if (editingTask && onUpdateTask) {
        await onUpdateTask(task)
      } else {
        await onCreateTask(task)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save task:', err)
    } finally {
      setSaving(false)
    }
  }

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim()
    if (normalized && !tags.includes(normalized)) {
      setTags([...tags, normalized])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  if (!isOpen) return null

  const connectedGateways = gateways.filter(g => g.status === 'connected')

  return (
    <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="task-modal">
        <div className="task-modal-header">
          <h2>{editingTask ? 'Edit Task' : 'Create Task'}</h2>
          <button className="task-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="task-modal-content">
          {/* Title */}
          <div className="task-form-row">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="task-form-row">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, context, or instructions..."
              rows={3}
            />
          </div>

          {/* Priority */}
          <div className="task-form-row">
            <label>Priority</label>
            <div className="priority-selector">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`priority-btn ${priority === opt.value ? 'active' : ''}`}
                  style={{ 
                    borderColor: priority === opt.value ? opt.color : undefined,
                    color: priority === opt.value ? opt.color : undefined
                  }}
                  onClick={() => setPriority(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to Agent */}
          <div className="task-form-row">
            <label>Assign to</label>
            <select
              value={assignedAgentId}
              onChange={(e) => setAssignedAgentId(e.target.value)}
            >
              <option value="">No agent assigned</option>
              {connectedGateways.map(gateway => (
                <option key={gateway.id} value={gateway.id}>
                  {gateway.avatar || '🤖'} {gateway.name}
                  {gateway.role && ` (${gateway.role})`}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="task-form-row">
            <label>Tags</label>
            <div className="tags-container">
              <div className="tags-list">
                {tags.map(tag => (
                  <span key={tag} className="task-tag">
                    {tag}
                    <button onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag..."
                className="tag-input"
              />
            </div>
            <div className="common-tags">
              {COMMON_TAGS.filter(t => !tags.includes(t)).slice(0, 5).map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="common-tag-btn"
                  onClick={() => addTag(tag)}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="task-modal-footer">
          {editingTask && onDeleteTask && (
            <button 
              className="task-btn danger" 
              onClick={async () => {
                await onDeleteTask(editingTask.id)
                onClose()
              }}
            >
              Delete
            </button>
          )}
          <div className="task-modal-spacer" />
          <button className="task-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="task-btn primary" 
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
