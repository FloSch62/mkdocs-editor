// Admonition kind → colour + icon, matching the Material for MkDocs / zensical palette.
// Kept in its own module (not a component file) so both the renderer and the editor can
// import it cleanly — and so hot-reload doesn't tangle the data with a component's refresh.
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined'
import NotesOutlinedIcon from '@mui/icons-material/Notes'
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

export const ADMONITION: Record<string, { color: string; Icon: SvgIconComponent }> = {
  note: { color: '#448aff', Icon: NotesOutlinedIcon },
  abstract: { color: '#00b0ff', Icon: SummarizeOutlinedIcon },
  summary: { color: '#00b0ff', Icon: SummarizeOutlinedIcon },
  info: { color: '#00b8d4', Icon: InfoOutlinedIcon },
  todo: { color: '#00b8d4', Icon: InfoOutlinedIcon },
  tip: { color: '#00bfa5', Icon: LightbulbOutlinedIcon },
  hint: { color: '#00bfa5', Icon: LightbulbOutlinedIcon },
  important: { color: '#00bfa5', Icon: LightbulbOutlinedIcon },
  success: { color: '#00c853', Icon: CheckCircleOutlineIcon },
  check: { color: '#00c853', Icon: CheckCircleOutlineIcon },
  question: { color: '#64dd17', Icon: HelpOutlineIcon },
  help: { color: '#64dd17', Icon: HelpOutlineIcon },
  warning: { color: '#ff9100', Icon: WarningAmberOutlinedIcon },
  caution: { color: '#ff9100', Icon: WarningAmberOutlinedIcon },
  attention: { color: '#ff9100', Icon: WarningAmberOutlinedIcon },
  failure: { color: '#ff5252', Icon: ErrorOutlineIcon },
  danger: { color: '#ff1744', Icon: ErrorOutlineIcon },
  error: { color: '#ff1744', Icon: ErrorOutlineIcon },
  bug: { color: '#f50057', Icon: BugReportOutlinedIcon },
  example: { color: '#7c4dff', Icon: NotesOutlinedIcon },
  quote: { color: '#9e9e9e', Icon: FormatQuoteOutlinedIcon },
  cite: { color: '#9e9e9e', Icon: FormatQuoteOutlinedIcon },
}
