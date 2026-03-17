import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

// ✅ UPDATED IMPORTS
import { Station1 } from './pages/Station1'; 
import { Station2 } from './pages/Station2'; 
import { Station3 } from './pages/Station3'; 
import { Station4 } from './pages/Station4'; 
import { Station5 } from './pages/Station5'; 
import { Station6 } from './pages/Station6'; 
import { Station7 } from './pages/Station7'; // NAYA Station jo aapne add kiya
import { Station8 } from './pages/Station8'; // PURANA Dashboard (Jo pehle 7 tha)
import { Station9 } from './pages/Station9'; // PURANA Detach (Jo pehle 8 tha)

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="station/1" element={<Station1 />} />
          <Route path="station/2" element={<Station2 />} />
          <Route path="station/3" element={<Station3 />} />
          <Route path="station/4" element={<Station4 />} />
          <Route path="station/5" element={<Station5 />} />
          <Route path="station/6" element={<Station6 />} />
          
          {/* ✅ NAYA STATION INSERTED HERE */}
          <Route path="station/7" element={<Station7 />} /> 
          
          {/* ✅ SHIFTED STATIONS */}
          <Route path="station/8" element={<Station8 />} />
          <Route path="station/9" element={<Station9 />} />
          
        </Route>
      </Routes>
    </Router>
  );
}
export default App;