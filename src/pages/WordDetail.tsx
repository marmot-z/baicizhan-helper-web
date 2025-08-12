import React from 'react';
import { useParams } from 'react-router-dom';

const WordDetail: React.FC = () => {
  const { word } = useParams<{ word: string }>();
  const currentWord = word || 'drove';
  
  // 响应式样式
  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: window.innerWidth <= 600 ? '10px' : '20px'
  };
  
  const cardStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: window.innerWidth <= 600 ? '1rem' : '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #e0e0e0'
  };
  
  const h1Style = {
    fontSize: window.innerWidth <= 600 ? '2rem' : '2.5rem',
    margin: '0',
    fontWeight: 'normal'
  };
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <div className="mx-auto" style={containerStyle}>
        {/* 单词信息 */}
        <section className="bg-white" style={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h1 style={h1Style}>{currentWord}</h1>
            <div className="inline-block align-middle" style={{ width: '24px', height: '24px', backgroundColor: '#e9ecef' }}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#6c757d', marginBottom: '1rem' }}>
            <span>/droʊv/</span>
            <div className="inline-block align-middle" style={{ width: '20px', height: '20px', backgroundColor: '#e9ecef' }}></div>
          </div>
          <p style={{ margin: '0.25rem 0' }}>v. 开车 (drive的过去式)；驱赶；迫使</p>
          <p style={{ margin: '0.25rem 0' }}>n. 畜群；人群</p>
        </section>

        {/* 单词变形 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>单词变形</h2>
          <div>
            <span style={{ backgroundColor: '#e9ecef', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>drive 的过去式</span>
          </div>
        </section>

        {/* 图文例句 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>图文例句</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem' }}>
            <p style={{ margin: '0' }}>He <strong>drove</strong> his wife home.</p>
            <div className="inline-block align-middle" style={{ width: '20px', height: '20px', backgroundColor: '#e9ecef' }}></div>
          </div>
          <p style={{ margin: '0.25rem 0' }}>他和妻子开车回家。</p>
          <div style={{ height: '150px', backgroundColor: '#e9ecef', borderRadius: '8px', marginTop: '1rem' }}></div>
        </section>

        {/* 详细释义 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>详细释义</h2>
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e7e7e7' }}>
            <p style={{ fontSize: '1rem', color: '#333', margin: '0 0 0.5rem 0' }}><strong>v.</strong> 开车 (drive的过去式)</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem' }}>
              <p style={{ margin: '0' }}>He <strong>drove</strong> his car through the gates at full pelt.</p>
              <div className="inline-block align-middle" style={{ width: '20px', height: '20px', backgroundColor: '#e9ecef' }}></div>
            </div>
            <p style={{ margin: '0.25rem 0' }}>他驾车飞速通过大门。</p>
          </div>
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e7e7e7' }}>
            <p style={{ fontSize: '1rem', color: '#333', margin: '0 0 0.5rem 0' }}><strong>v.</strong> 驱赶</p>
          </div>
          <div style={{ marginBottom: '0', paddingBottom: '0' }}>
            <p style={{ fontSize: '1rem', color: '#333', margin: '0 0 0.5rem 0' }}><strong>n.</strong> 畜群</p>
          </div>
        </section>

        {/* 短语 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>短语</h2>
          <div style={{ fontSize: '1.1rem' }}>
            <p style={{ margin: '0' }}>drive someone crazy</p>
            <p style={{ margin: '0.25rem 0' }}>把某人逼疯</p>
          </div>
        </section>

        {/* 近义词 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>近义词</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>group</a>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>horde</a>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>throng</a>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>crowd</a>
          </div>
        </section>

        {/* 形近词 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>形近词</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>drill</a>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>dream</a>
            <a href="#" style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>droop</a>
          </div>
        </section>

        {/* 词根词缀 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>词根词缀</h2>
          <p style={{ margin: '0' }}>drive {'->'} drove (不规则动词过去式)</p>
        </section>

        {/* 英文释义 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>英文释义</h2>
          <div>
            <p style={{ fontWeight: 'bold', margin: '0' }}>v.</p>
            <ol style={{ paddingLeft: '1.5rem', margin: '0' }}>
              <li style={{ marginBottom: '0.5rem' }}>to operate a vehicle so that it goes in a particular direction; to take sb somewhere in a car, taxi, etc.</li>
              <li style={{ marginBottom: '0.5rem' }}>to force somebody to act in a particular way</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WordDetail;