import React from 'react';

const Pagination = ({ currentPage, totalPages, setCurrentPage }) => {
    const maxPageButtons = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-center items-center space-x-2 mt-6 mb-6">
            <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} // แก้ไขตรงนี้
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition"
            >
                ←
            </button>

            {startPage > 1 && (
                <>
                    <button onClick={() => setCurrentPage(1)} className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300">1</button>
                    {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                </>
            )}

            {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
                <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg ${currentPage === page ? 'bg-green-500 text-white font-bold' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                    {page}
                </button>
            ))}

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                    <button onClick={() => setCurrentPage(totalPages)} className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300">{totalPages}</button>
                </>
            )}

            <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} // แก้ไขตรงนี้
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition"
            >
                →
            </button>
        </div>
    );
};
export default Pagination;