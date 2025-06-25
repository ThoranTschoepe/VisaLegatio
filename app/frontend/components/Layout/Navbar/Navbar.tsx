"use client"

import { useRouter, usePathname } from "next/navigation"
import React from "react"
import DarkModeSwitcher from "@/components/Layout/DarkModeSwitcher/DarkModeSwitcher"

const Navbar = () => {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="navbar">
      <div className="flex-1">
        {pathname === "/" ? (
          <button className="btn btn-ghost normal-case text-2xl logo" onClick={() => window.location.reload()}>
            ⚓ SKS Trainer
          </button>
        ) : (
          <button className="btn btn-ghost normal-case text-2xl logo" onClick={() => router.push("/")}>
            ⚓ SKS Trainer
          </button>
        )}
      </div>
      
      <div className="flex-none gap-2">
        <DarkModeSwitcher />
      </div>
    </div>
  )
}

export default Navbar