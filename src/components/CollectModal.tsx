import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faBookBookmark } from '@fortawesome/free-solid-svg-icons';
import type { UserBookItem } from '../types';
import './CollectModal.css';

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
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-content">
          <h2 className="modal-title">将单词添加到</h2>
          <ul className="book-list">
            {userBooks.map((book) => (
              <li 
                key={book.user_book_id} 
                className="book-item"
                onClick={() => onToggleBookSelection(book.user_book_id)}
              >
                <div className="book-info">
                  <FontAwesomeIcon 
                    icon={faBookBookmark} 
                    className="book-icon"
                  />
                  <span className="book-name">{book.book_name}</span>
                </div>
                <FontAwesomeIcon 
                  icon={faStar} 
                  className={`star-icon ${selectedBookId === book.user_book_id ? 'star-selected' : 'star-unselected'}`}
                />
              </li>
            ))}
          </ul>

          <div className="button-container">
            <button onClick={onCancel} className="button cancel-button">取消</button>
            <button onClick={onSave} className="button save-button">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectModal;