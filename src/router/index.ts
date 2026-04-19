import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home-page.vue'),
    },
    {
      path: '/how-to-play',
      name: 'how-to-play',
      component: () => import('@/pages/how-to-play.vue'),
    },
    {
      path: '/about-us',
      name: 'about-us',
      component: () => import('@/pages/about-us.vue'),
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('@/pages/game.vue'),
    },
  ],
})

export default router
