// src/contexts/ProjectContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Project state interface
export interface ProjectState {
    projectId: string | null;
    projectName: string;
    dslContent: string;
    isEditing: boolean;

    // Validation state
    isValidated: boolean;
    isValidationPassed: boolean;
    validationResult: any | null;
    validationError: string | null;
    parsedData: any | null;

    // Lifecycle flags
    isDirty: boolean; // Has unsaved changes
    lastSaved: Date | null;
}

// Actions interface
export interface ProjectActions {
    loadProject: (data: {
        projectId: string;
        projectName: string;
        dslContent: string;
        metadata?: any;
        isEditing?: boolean;
    }) => void;
    setEditing: (editing: boolean) => void;
    updateDSL: (content: string) => void;
    updateProjectName: (name: string) => void;
    saveValidation: (result: {
        isValidated: boolean;
        isValidationPassed: boolean;
        validationResult: any | null;
        validationError: string | null;
        parsedData: any | null;
    }) => void;
    markSaved: () => void;
    resetProject: () => void;
    setDirty: (dirty: boolean) => void;
}

// Combined context type
interface ProjectContextType {
    state: ProjectState;
    actions: ProjectActions;
}

// Initial state
const initialState: ProjectState = {
    projectId: null,
    projectName: '',
    dslContent: '',
    isEditing: false,
    isValidated: false,
    isValidationPassed: false,
    validationResult: null,
    validationError: null,
    parsedData: null,
    isDirty: false,
    lastSaved: null,
};

// Create context
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Provider component
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ProjectState>(() => {
        // Try to recover from localStorage on initial mount
        try {
            const saved = localStorage.getItem('dbdoc_projectContext');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...initialState,
                    ...parsed,
                    lastSaved: parsed.lastSaved ? new Date(parsed.lastSaved) : null,
                };
            }
        } catch (err) {
            console.error('Failed to recover project state:', err);
        }
        return initialState;
    });

    // Persist to localStorage whenever state changes (for refresh recovery)
    useEffect(() => {
        if (state.projectId || state.dslContent) {
            localStorage.setItem('dbdoc_projectContext', JSON.stringify(state));
        } else {
            localStorage.removeItem('dbdoc_projectContext');
        }
    }, [state]);

    // Actions
    const loadProject: ProjectActions['loadProject'] = (data) => {
        console.log('📦 loadProject called with data:', {
            projectId: data.projectId,
            hasMetadata: !!data.metadata,
            metadata: data.metadata
        });

        setState({
            projectId: data.projectId,
            projectName: data.projectName,
            dslContent: data.dslContent,
            isEditing: data.isEditing ?? false,
            // Load validation metadata if available
            isValidated: data.metadata?.isValidated ?? false,
            isValidationPassed: data.metadata?.isValidationPassed ?? false,
            validationResult: data.metadata?.validationResult ?? null,
            validationError: null,
            parsedData: data.metadata?.parsedData ?? null,
            isDirty: false,
            lastSaved: data.metadata?.lastValidated ? new Date(data.metadata.lastValidated) : null,
        });

        console.log('✅ Project loaded into context:', {
            isValidated: data.metadata?.isValidated ?? false,
            isValidationPassed: data.metadata?.isValidationPassed ?? false
        });
    };

    const setEditing: ProjectActions['setEditing'] = (editing) => {
        setState((prev) => ({ ...prev, isEditing: editing }));
    };

    const updateDSL: ProjectActions['updateDSL'] = (content) => {
        setState((prev) => ({
            ...prev,
            dslContent: content,
            isDirty: true,
            // Reset validation when DSL changes
            isValidated: false,
            isValidationPassed: false,
            validationResult: null,
            validationError: null,
        }));
    };

    const updateProjectName: ProjectActions['updateProjectName'] = (name) => {
        setState((prev) => ({
            ...prev,
            projectName: name,
            isDirty: prev.projectId ? true : prev.isDirty, // Mark dirty if editing existing project
        }));
    };

    const saveValidation: ProjectActions['saveValidation'] = (result) => {
        setState((prev) => ({ ...prev, ...result }));
    };

    const markSaved: ProjectActions['markSaved'] = () => {
        setState((prev) => ({
            ...prev,
            isDirty: false,
            isEditing: false, // Return to read-only after save
            lastSaved: new Date(),
        }));
    };

    const resetProject: ProjectActions['resetProject'] = () => {
        setState(initialState);
        localStorage.removeItem('dbdoc_projectContext');
    };

    const setDirty: ProjectActions['setDirty'] = (dirty) => {
        setState((prev) => ({ ...prev, isDirty: dirty }));
    };

    const actions: ProjectActions = {
        loadProject,
        setEditing,
        updateDSL,
        updateProjectName,
        saveValidation,
        markSaved,
        resetProject,
        setDirty,
    };

    return (
        <ProjectContext.Provider value={{ state, actions }}>
            {children}
        </ProjectContext.Provider>
    );
};

// Custom hook to use the project context
export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context.state;
};

// Custom hook to use the project actions
export const useProjectActions = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProjectActions must be used within a ProjectProvider');
    }
    return context.actions;
};
