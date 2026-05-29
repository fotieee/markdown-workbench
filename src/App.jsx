import { createRoot } from 'react-dom/client';
import { Sidebar, EditorArea } from './components/WorkbenchLayout';
import { configureMarkdownRenderer } from './markdownRenderer';
import { useWorkbenchController } from './hooks/useWorkbenchController';
import './styles.css';

configureMarkdownRenderer();

function App() {
  const { appState, appActions, refs, explorerGridStyle, theme, isExplorerCollapsed } = useWorkbenchController();

  return (
    <main className={`workbench theme-${theme} ${isExplorerCollapsed ? 'explorer-collapsed' : ''}`} style={explorerGridStyle}>
      <Sidebar appState={appState} appActions={appActions} />
      <EditorArea appState={appState} appActions={appActions} editorContentRef={refs.editorContentRef} searchInputRef={refs.searchInputRef} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
