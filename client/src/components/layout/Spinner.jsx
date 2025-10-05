import React from 'react';

/**
 * A simple loading spinner component.
 * It's centered within a container for easy use on loading pages.
 */
const Spinner = () => {
  return (
    <div className="flex justify-center items-center p-10">
      <div 
        className="
          w-16 h-16               // Sets the size of the spinner
          border-8                // Sets the thickness of the border
          border-gray-200         // Sets the color of the main circle
          border-t-primary        // Sets the color of the top part, creating the spinning effect
          rounded-full            // Makes the element a perfect circle
          animate-spin            // Applies the spinning animation from TailwindCSS
        "
      >
      </div>
    </div>
  );
};

export default Spinner;