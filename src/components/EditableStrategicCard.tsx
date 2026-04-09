import { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface EditableStrategicCardProps {
  title: string;
  content: string;
  highlight?: boolean;
  onSave: (newContent: string) => void;
}

export function EditableStrategicCard({ title, content, highlight, onSave }: EditableStrategicCardProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(content);
  }, [content]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed !== content) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(content);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && e.ctrlKey) handleSave();
  };

  return (
    <div className={`group rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'} shadow-card transition-shadow hover:shadow-md`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
            title="Editar"
          >
            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-sm min-h-[60px] resize-none"
            rows={3}
          />
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={handleCancel}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              title="Cancelar (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSave}
              className="p-1.5 rounded hover:bg-primary/10 text-primary"
              title="Salvar (Ctrl+Enter)"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm text-foreground leading-relaxed cursor-pointer"
          onDoubleClick={() => setEditing(true)}
        >
          {content}
        </p>
      )}
    </div>
  );
}
