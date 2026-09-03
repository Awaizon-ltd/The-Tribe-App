import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Ecosystem from "./components/Ecosystem";
import Pillars from "./components/Pillars";
import Download from "./components/Download";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="min-h-screen bg-ink">
      <Navbar />
      <main>
        <Hero />
        <Ecosystem />
        <Pillars />
        <Download />
      </main>
      <Footer />
    </div>
  );
}

export default App;
