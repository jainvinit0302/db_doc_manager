import { Button } from "@/components/ui/button";
import { FolderOpen, Trash2, Clock } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    lastUpdated: string;
  };
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

export const ProjectCard = ({ project, onDelete, onOpen }: ProjectCardProps) => {
  return (
    <div className="glass-card rounded-xl p-6 space-y-4 hover-lift">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{project.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {project.lastUpdated}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="default" className="flex-1" onClick={() => onOpen(project.id)}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Open
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDelete(project.id)}
          className="bg-background/50 hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
