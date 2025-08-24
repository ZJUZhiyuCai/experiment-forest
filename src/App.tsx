import { Routes, Route } from "react-router-dom";
import { useState, Suspense, lazy } from "react";
import { AuthContext } from '@/contexts/authContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";

// 懒加载组件
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ExperimentRecords = lazy(() => import("@/pages/ExperimentRecords"));
const CreateRecord = lazy(() => import("@/pages/CreateRecord"));
const RecordDetail = lazy(() => import("@/pages/RecordDetail"));
const Notes = lazy(() => import("@/pages/Notes"));
const CreateNote = lazy(() => import("@/pages/CreateNote"));
const NoteDetail = lazy(() => import("@/pages/NoteDetail"));
const SOPs = lazy(() => import("@/pages/SOPs"));
const CreateSOP = lazy(() => import("@/pages/CreateSOP"));
const SOPDetail = lazy(() => import("@/pages/SOPDetail"));
const SampleManagement = lazy(() => import("@/pages/SampleManagement"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Settings = lazy(() => import("@/pages/Settings"));
const MyForest = lazy(() => import("@/pages/MyForest"));
const AIChat = lazy(() => import("@/pages/AIChat"));
const Topics = lazy(() => import("@/pages/Topics"));
const TopicDetail = lazy(() => import("@/pages/TopicDetail"));
const CreateTopic = lazy(() => import("@/pages/CreateTopic"));

// 新增课题相关功能
const TopicMindMap = lazy(() => import("@/pages/TopicMindMap"));

// 懒加载的fallback组件
const LazyFallback = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <LoadingSkeleton type="card" count={3} />
  </div>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // 默认已认证，实际项目中应根据登录状态判断

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, setIsAuthenticated, logout }}
    >
      <ErrorBoundary>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/forest" element={<MyForest />} />
            <Route path="/chat" element={<AIChat />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/topics/new" element={<CreateTopic />} />
            <Route path="/topics/:id" element={<TopicDetail />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/records" element={<ExperimentRecords />} />
            <Route path="/projects/:id/notes" element={<Notes />} />
            <Route path="/projects/:id/sops" element={<SOPs />} />
            <Route path="/records" element={<ExperimentRecords />} />
            <Route path="/records/new" element={<CreateRecord />} />
            <Route path="/records/edit/:id" element={<CreateRecord />} />
            <Route path="/records/:id" element={<RecordDetail />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/new" element={<CreateNote />} />
            <Route path="/notes/edit/:id" element={<CreateNote />} />
            <Route path="/notes/:id" element={<NoteDetail />} />
            <Route path="/sops" element={<SOPs />} />
            <Route path="/sops/new" element={<CreateSOP />} />
            <Route path="/sops/:id" element={<SOPDetail />} />
            <Route path="/samples" element={<SampleManagement />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/settings" element={<Settings />} />
            {/* 课题相关功能路由 */}
            <Route path="/topics/:id/mindmap" element={<TopicMindMap />} />
            <Route path="*" element={<div className="text-center text-xl">页面未找到</div>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}