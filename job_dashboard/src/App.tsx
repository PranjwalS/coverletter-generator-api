// import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import TemplateJobPage from './pages/JobPage';
import AppliedDashboard from './pages/AppliedDashboard';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/jobs/:slug' element={<TemplateJobPage />} />
        <Route path="*" element={<NotFound />} />
        <Route path='/applied' element={<AppliedDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;
