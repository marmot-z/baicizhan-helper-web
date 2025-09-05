import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faBookBookmark } from '@fortawesome/free-solid-svg-icons';
import type { UserBookItem } from '../types';

interface CollectModalProps {
  showModal: boolean;
  userBooks: UserBookItem[];
  selectedBookId: number | null;
  onToggleBookSelection: (bookId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

const CollectModal: React.FC<CollectModalProps> = ({
  showModal,
  userBooks,
  selectedBookId,
  onToggleBookSelection,
  onSave,
  onCancel
}) => {
  if (!showModal) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '20px',
        margin: '20px'
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 0,
            color: '#6c757d'
          }}>将单词添加到</h2>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {userBooks.map((book, index) => (
              <li key={book.user_book_id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0',
                borderBottom: index === userBooks.length - 1 ? 'none' : '1px solid #e7e7e7',
                cursor: 'pointer'
              }} onClick={() => onToggleBookSelection(book.user_book_id)}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <FontAwesomeIcon 
                    icon={faBookBookmark} 
                    style={{
                      fontSize: '20px',
                      color: '#000'
                    }}
                  />
                  <span style={{
                    fontSize: '1.1rem',
                    fontWeight: '500'
                  }}>{book.book_name}</span>
                </div>
                <FontAwesomeIcon 
                  icon={faStar} 
                  style={{
                    fontSize: '1.2rem',
                    color: selectedBookId === book.user_book_id ? '#007bff' : '#d3d3d3'
                  }}
                />
              </li>
            ))}
          </ul>

          <div style={{
            display: 'flex',
            gap: '1rem'
          }}>
            <button onClick={onCancel} style={{
              flex: 1,
              padding: '0.8rem 1rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: '#e9ecef',
              color: '#333'
            }}>取消</button>
            <button onClick={onSave} style={{
              flex: 1,
              padding: '0.8rem 1rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: '#007bff',
              color: '#fff'
            }}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectModal;