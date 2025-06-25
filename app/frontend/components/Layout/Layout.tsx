import React, { ReactNode } from "react"
import AlertContainer from "@/components/Alert/AlertContainer"
import Footer from "./Footer/Footer"
import Navbar from "./Navbar/Navbar"

interface LayoutProps {
  children: ReactNode
}

const Layout = (props: LayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen justify-between">
      <Navbar />
      <AlertContainer />
      <div className="container pt-14 pb-24">{props.children}</div>
      <Footer />
    </div>
  )
}

export default Layout