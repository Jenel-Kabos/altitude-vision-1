import React from "react";
import Slider from "react-slick";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Marie K.",
    role: "Cliente Altimmo",
    text: "Grâce à Altitude-Vision, j'ai trouvé ma maison rapidement et sans stress !",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Jean P.",
    role: "Client MilaEvents",
    text: "Organisation parfaite de notre mariage. L'équipe est professionnelle et créative.",
    image: "https://images.unsplash.com/photo-1603415526960-f7e0328e3d31?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Claire D.",
    role: "Cliente Altcom",
    text: "Leur stratégie marketing a boosté ma visibilité en quelques semaines.",
    image: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=200&q=80",
  },
];

const Testimonials = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: false,
  };

  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white relative overflow-hidden">
      {/* Halo animé global en fond */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#2563eb_0%,transparent_40%),radial-gradient(circle_at_70%_80%,#7c3aed_0%,transparent_40%)] animate-pulse-slow"></div>

      <div className="container mx-auto px-6 md:px-12 lg:px-24 relative z-10">
        <motion.h2
          className="text-4xl md:text-5xl font-extrabold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Ce que disent nos clients
        </motion.h2>

        <Slider {...settings}>
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center text-center px-6 md:px-20 relative"
            >
              {/* Halo individuel derrière le portrait */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse-slow"></div>

              <motion.div
                className="relative mb-6"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover shadow-2xl border-4 border-gray-800 relative z-10"
                />
                <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2 rounded-full shadow-md z-20">
                  <Quote size={20} />
                </div>
              </motion.div>

              <motion.p
                className="text-lg italic text-gray-300 leading-relaxed mb-6 max-w-2xl relative z-10"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                “{t.text}”
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="relative z-10"
              >
                <h4 className="font-semibold text-xl text-white">{t.name}</h4>
                <p className="text-blue-400">{t.role}</p>
              </motion.div>
            </motion.div>
          ))}
        </Slider>
      </div>
    </section>
  );
};

export default Testimonials;
