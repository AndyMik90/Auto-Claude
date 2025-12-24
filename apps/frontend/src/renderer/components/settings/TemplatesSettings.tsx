import { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, Pencil, Key, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { SettingsSection } from './SettingsSection';
import type { Template } from '../../../shared/types';
import { AddTemplateDialog } from './AddTemplateDialog';
import { SecretsManager } from './SecretsManager';

type View = 'templates' | 'secrets';

export function TemplatesSettings() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [view, setView] = useState<View>('templates');

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsAddDialogOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsAddDialogOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteTemplate(templateId);
      if (result.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleTemplateSaved = () => {
    loadTemplates();
    setIsAddDialogOpen(false);
    setEditingTemplate(null);
  };

  if (isLoading) {
    return (
      <SettingsSection
        title="Templates"
        description="Manage your project templates"
      >
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      </SettingsSection>
    );
  }

  // Render Secrets view
  if (view === 'secrets') {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-start justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('templates')}
              className="gap-2 -ml-2 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Templates
            </Button>
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Key className="h-6 w-6" />
              Secrets Manager
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Securely manage encrypted credentials with group templates and account instances
            </p>
          </div>
        </div>

        {/* Secrets Manager Content */}
        <SecretsManager />
      </div>
    );
  }

  // Render Templates view
  return (
    <div className="space-y-6">
        {/* Header with Secrets Button */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage reusable project templates
            </p>
          </div>
          <Button onClick={() => setView('secrets')} variant="outline" className="gap-2">
            <Key className="h-4 w-4" />
            Secrets
          </Button>
        </div>

        <div className="space-y-4">
          {/* Add Template Button */}
          <div>
            <Button onClick={handleAddTemplate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </div>

          {/* Templates Grid */}
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Folder className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first project template to get started
              </p>
              <Button onClick={handleAddTemplate} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="group relative overflow-hidden hover:border-accent transition-all"
                >
                  <CardContent className="p-4">
                    {/* Template Image/Icon */}
                    <div className="aspect-video rounded-md bg-muted mb-3 flex items-center justify-center overflow-hidden">
                      {template.imagePath ? (
                        <img
                          src={`file://${template.imagePath}`}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Folder className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>

                    {/* Template Name */}
                    <h3 className="font-medium text-sm mb-1 truncate">{template.name}</h3>

                    {/* Template Path */}
                    <p className="text-xs text-muted-foreground truncate mb-3">
                      {template.folderPath}
                    </p>

                    {/* Action Buttons (shown on hover) */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                        className="flex-1 gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Template Dialog */}
        <AddTemplateDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          template={editingTemplate}
          onSaved={handleTemplateSaved}
        />
      </div>
  );
}
