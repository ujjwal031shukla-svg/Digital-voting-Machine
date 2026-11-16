import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'

const PIN = ['1', '2', '3', '4']
const MACHINE_KEY_HEX = '0'.repeat(64) // 32 zero bytes — test-only machine key

const user = {
  click: (el) => fireEvent.click(el),
  type: (el, value) => fireEvent.change(el, { target: { value } }),
  clear: (el) => fireEvent.change(el, { target: { value: '' } }),
}

function openOfficerDrawer() {
  user.click(screen.getByRole('button', { name: 'Officer sign-in' }))
}

function enterPin(digits) {
  for (const d of digits) user.click(screen.getByRole('button', { name: d }))
  user.click(screen.getByRole('button', { name: 'ENT' }))
}

async function armReady() {
  openOfficerDrawer()
  enterPin(PIN)
  await screen.findByText(/STATE 02/)
}

function verifyVoter(id = 'EPIC-000001') {
  const input = screen.getByRole('textbox', { name: 'Voter ID' })
  user.clear(input)
  user.type(input, id)
  user.click(screen.getByRole('button', { name: 'VERIFY' }))
}

function uploadDoc(name = 'epic.png') {
  const input = screen.getByLabelText(/upload voter id/i)
  const file = new File([new Uint8Array([11, 22, 33, 44])], name, { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
}

const candidateBtn = () => screen.getByRole('radio', { name: /ELENA ROSTOVA/i })
const confirmBtn = () => screen.getByRole('button', { name: /confirm selection/i })

const bytesToB64 = (b) => btoa(String.fromCharCode(...b))
const sha256Hex = async (buf) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((x) => x.toString(16).padStart(2, '0')).join('')

// Seed an AES-256-GCM encrypted `dvm_votes` payload (same v2 format the app reads at boot)
async function seedVotes({ candidateVotes = { 1: 1 }, totalVoters = 1, voterIdHashes = [] }) {
  const raw = new Uint8Array(MACHINE_KEY_HEX.match(/.{2}/g).map((b) => parseInt(b, 16)))
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = JSON.stringify({ candidateVotes, totalVoters, voterHasVoted: true, voterIdHashes, voterDocHashes: [] })
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  window.localStorage.setItem('dvm_machine_key', MACHINE_KEY_HEX)
  window.localStorage.setItem('dvm_votes', JSON.stringify({ v: 2, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) }))
}
const epicHash = async (epic) => sha256Hex(new TextEncoder().encode('DVM-VOTER\x00' + epic))

beforeEach(() => {
  window.localStorage.clear()
})

describe('DVM FSM — officer arm → voter flow', () => {
  it('arms the ballot with officer PIN (IDLE → READY)', async () => {
    render(<App />)
    await armReady()
    expect(candidateBtn()).toBeDisabled() // voter not verified yet
  })

  it('enables candidate keys after EPIC verification (ballot not castable until doc uploaded)', async () => {
    render(<App />)
    await armReady()
    expect(candidateBtn()).toBeDisabled()
    verifyVoter()
    expect(await screen.findByText(/ID VERIFIED/i)).toBeInTheDocument()
    expect(candidateBtn()).toBeEnabled() // EPIC gate lifts the keys
    user.click(candidateBtn())
    expect(confirmBtn()).toBeDisabled() // document gate holds the cast button
    uploadDoc()
    expect(await screen.findByText(/ID DOC ACCEPTED/i)).toBeInTheDocument()
    expect(confirmBtn()).toBeEnabled()
  })

  it('requires an ID document before the ballot can be confirmed (document gate)', async () => {
    render(<App />)
    await armReady()
    verifyVoter()
    await screen.findByText(/ID VERIFIED/i)
    user.click(candidateBtn())
    expect(confirmBtn()).toBeDisabled()
    uploadDoc()
    expect(await screen.findByText(/ID DOC ACCEPTED/i)).toBeInTheDocument()
    expect(confirmBtn()).toBeEnabled()
  })

  it('casts exactly one ballot (READY → VOTED)', async () => {
    render(<App />)
    await armReady()
    verifyVoter()
    await screen.findByText(/ID VERIFIED/i)
    uploadDoc()
    await screen.findByText(/ID DOC ACCEPTED/i)
    user.click(candidateBtn())
    user.click(confirmBtn())
    user.click(screen.getByRole('button', { name: 'CAST VOTE' }))
    expect(await screen.findByText(/ballot signed/i)).toBeInTheDocument()
  })

  it('blocks the same voter ID across reloads (duplicate EPIC rejected)', async () => {
    await seedVotes({ candidateVotes: { 1: 1 }, totalVoters: 1, voterIdHashes: [await epicHash('EPIC-000001')] })
    render(<App />)
    await armReady()
    verifyVoter('EPIC-000001')
    expect(await screen.findByText(/already been used/i)).toBeInTheDocument()
    expect(candidateBtn()).toBeDisabled() // duplicate → ID never verified
    expect(confirmBtn()).toBeDisabled()
  })

  it('tally survives reload (vote recorded, winner shown in tally)', async () => {
    await seedVotes({ candidateVotes: { 1: 1 }, totalVoters: 1, voterIdHashes: [await epicHash('EPIC-000001')] })
    render(<App />)
    openOfficerDrawer()
    user.click(screen.getByRole('button', { name: /OPEN TALLY & AUDIT REGISTER/i }))
    expect(await screen.findByText('WINNER')).toBeInTheDocument()
    expect(screen.getAllByText('ELENA ROSTOVA').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1 RECORDED/i)).toBeInTheDocument()
  })

  it('officer PIN lockout after 3 failed attempts', async () => {
    render(<App />)
    openOfficerDrawer()
    enterPin(['9', '9', '9', '9'])
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 left/i)
    enterPin(['8', '8', '8', '8'])
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 left/i)
    enterPin(['7', '7', '7', '7'])
    expect(await screen.findByRole('alert')).toHaveTextContent(/KEYPAD LOCKED/i)
  })

  it('locked-out state survives reload (keypad refuses new digits)', async () => {
    window.localStorage.setItem('dvm_pin_lock', JSON.stringify({ fails: 0, lockUntil: Date.now() + 60000 }))
    render(<App />)
    openOfficerDrawer()
    user.click(screen.getByRole('button', { name: '1' }))
    expect(await screen.findByText(/Keypad locked/i)).toBeInTheDocument()
  })

  it('LOCKED → RESULT → IDLE via officer flow', async () => {
    render(<App />)
    await armReady()
    openOfficerDrawer()
    user.click(screen.getByRole('button', { name: /SEAL TERMINAL & CLOSE/i }))
    user.click(screen.getByRole('button', { name: 'SEAL & LOCK' }))
    expect(await screen.findByText(/Terminal sealed/i)).toBeInTheDocument()
    openOfficerDrawer()
    user.click(screen.getByRole('button', { name: /OPEN TALLY & AUDIT REGISTER/i }))
    expect(await screen.findByText(/total ballots recorded/i)).toBeInTheDocument()
    user.click(screen.getByRole('button', { name: /RETURN TO TERMINAL STANDBY/i }))
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Clutch disengaged. Officer must arm voter session.')).toBeInTheDocument()
    expect(candidateBtn()).toBeDisabled()
  })
})
