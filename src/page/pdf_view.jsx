import React, { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import styles from '../css/pdf_viewer.module.css';

// ✅ PDF.js 워커 설정 (버전 호환 안전하게)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

/**
 * PDF 업로드 + 전체화면 뷰어
 * - drag & drop 업로드
 * - 페이지 이동, 줌, 회전
 * - 현재 페이지 표시
 * - 다운로드
 * - 에러 처리
 */
export default function PdfViewerPage() {
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null); // File object
    const [fileUrl, setFileUrl] = useState(null); // Object URL for react-pdf
    const [fileName, setFileName] = useState("");

    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);

    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);

    const [isDragging, setIsDragging] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [assigneeRrn, setAssigneeRrn] = useState("");       // 양수인 주민번호(마스킹 전 문자열)

    const onChangeRrn = (e) => {
        const raw = e.target.value.replace(/\D/g, ""); // 숫자만
        const front = raw.slice(0, 6);
        const back = raw.slice(6, 13);
        const formatted = back.length > 0 ? `${front}-${back}` : front;
        setAssigneeRrn(formatted);
    };

    // Object URL 라이프사이클 관리
    useEffect(() => {
        if (!file) return;

        const url = URL.createObjectURL(file);
        setFileUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file]);

    const acceptMime = useMemo(() => ["application/pdf"], []);

    const pickFile = () => fileInputRef.current?.click();

    const onFileSelected = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        handleFile(f);
        // 같은 파일 다시 선택 가능하도록 reset
        e.target.value = "";
    };

    const handleFile = (f) => {
        setErrorMsg("");
        setNumPages(null);
        setPageNumber(1);
        setScale(1.0);
        setRotation(0);

        if (!acceptMime.includes(f.type)) {
            setErrorMsg("PDF 파일만 업로드할 수 있어요.");
            return;
        }

        // 50MB 제한 예시 (원하면 조절)
        const maxBytes = 50 * 1024 * 1024;
        if (f.size > maxBytes) {
            setErrorMsg("파일이 너무 커요. (최대 50MB)");
            return;
        }

        setFile(f);
        setFileName(f.name);
    };

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        handleFile(f);
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const onDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const onDocLoadSuccess = ({ numPages: n }) => {
        setNumPages(n);
        setPageNumber(1);
    };

    const onDocLoadError = (err) => {
        console.error(err);
        setErrorMsg("PDF를 불러오지 못했어요. 파일이 손상되었거나 형식이 올바르지 않을 수 있어요.");
    };

    const clampPage = (p) => {
        if (!numPages) return 1;
        return Math.max(1, Math.min(numPages, p));
    };

    const goPrev = () => setPageNumber((p) => clampPage(p - 1));
    const goNext = () => setPageNumber((p) => clampPage(p + 1));

    const zoomOut = () => setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10));
    const zoomIn = () => setScale((s) => Math.min(3.0, Math.round((s + 0.1) * 10) / 10));
    const resetView = () => {
        setScale(1.0);
        setRotation(0);
    };

    const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
    const rotateRight = () => setRotation((r) => (r + 90) % 360);

    const clearFile = () => {
        setFile(null);
        setFileUrl(null);
        setFileName("");
        setNumPages(null);
        setPageNumber(1);
        setScale(1.0);
        setRotation(0);
        setErrorMsg("");
    };

    return (
        <div className={styles.app}>
            {/* Top Bar */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.brand}>PDF Viewer</div>
                    {fileName ? (
                        <div className={styles.fileName} title={fileName}>
                            {fileName}
                        </div>
                    ) : null}
                </div>

                <div className={styles.headerRight}>
                    <button className={styles.primaryBtn} onClick={pickFile}>
                        PDF 업로드
                    </button>

                    {file ? (
                        <>
                            <button className={styles.btn} onClick={clearFile}>초기화</button>
                            {fileUrl ? (
                                <a className={styles.btn} href={fileUrl} download={fileName || "document.pdf"}>
                                    다운로드
                                </a>
                            ) : null}
                        </>
                    ) : null}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={onFileSelected}
                        className={{ display: "none" }}
                    />
                </div>
            </header>

            {/* Main */}
            <main
                className={{
                    ...styles.main,
                    outline: isDragging ? "2px dashed #888" : "none",
                    outlineOffset: "-10px",
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
            >
                {/* ✅ 입력/업로드 섹션: 항상 표시 */}
                <div className={styles.formArea}>
                    <div className={styles.formTitle}>정보 입력</div>
                    <div className={styles.formRow}>
                        <label className={styles.label}>양수인 주민등록번호</label>
                        <input
                            className={styles.input}
                            value={assigneeRrn}
                            onChange={onChangeRrn}
                            inputMode="numeric"
                            placeholder="######-#######"
                            autoComplete="off"
                        />
                        <div className={styles.hint}>
                            * 숫자만 입력하면 자동으로 하이픈이 들어갑니다.
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <button className={styles.primaryBtn} onClick={pickFile}>
                            PDF 파일 선택
                        </button>
                        {!file ? <div className={styles.hint}>업로드하면 아래에 PDF 뷰어가 표시됩니다.</div> : null}
                    </div>

                    {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}
                </div>

                {/* ✅ Viewer: 파일 업로드(=fileUrl 존재)일 때만 아래에 표시 */}
                {fileUrl ? (
                    <div className={styles.viewerShell}>
                        {/* Controls */}
                        <div className={styles.controls}>
                            <div className={styles.controlsGroup}>
                                <button className={styles.btn} onClick={goPrev} disabled={!numPages || pageNumber <= 1}>
                                    ◀
                                </button>

                                <div className={styles.pageIndicator}>
                                    <input
                                        className={styles.pageInput}
                                        value={pageNumber}
                                        onChange={(e) => {
                                            const v = Number(e.target.value.replace(/\D/g, "")) || 1;
                                            setPageNumber(clampPage(v));
                                        }}
                                        onBlur={() => setPageNumber((p) => clampPage(p))}
                                        inputMode="numeric"
                                    />
                                    <span className={styles.pageSlash}>/</span>
                                    <span className={styles.pageTotal}>{numPages ?? "—"}</span>
                                </div>

                                <button className={styles.btn} onClick={goNext} disabled={!numPages || pageNumber >= numPages}>
                                    ▶
                                </button>
                            </div>

                            <div className={styles.controlsGroup}>
                                <button className={styles.btn} onClick={zoomOut}>-</button>
                                <div className={styles.zoomLabel}>{Math.round(scale * 100)}%</div>
                                <button className={styles.btn} onClick={zoomIn}>+</button>
                            </div>

                            <div className={styles.controlsGroup}>
                                <button className={styles.btn} onClick={rotateLeft}>⟲</button>
                                <button className={styles.btn} onClick={rotateRight}>⟳</button>
                                <button className={styles.btn} onClick={resetView}>리셋</button>
                            </div>
                        </div>

                        {/* PDF Canvas Area */}
                        <div className={styles.canvasArea}>
                            <div className={styles.docWrap}>
                                <Document
                                    file={fileUrl}
                                    onLoadSuccess={onDocLoadSuccess}
                                    onLoadError={onDocLoadError}
                                    loading={<div className={styles.loading}>불러오는 중…</div>}
                                    error={<div className={styles.error}>PDF를 렌더링하지 못했어요.</div>}
                                    noData={<div className={styles.error}>파일이 없어요.</div>}
                                >
                                    <Page
                                        pageNumber={pageNumber}
                                        scale={scale}
                                        rotate={rotation}
                                        renderTextLayer={false}      // ✅ 추출된 글자 제거
                                        renderAnnotationLayer={false}
                                        loading={<div className={styles.loading}>페이지 렌더링 중…</div>}
                                    />
                                </Document>
                            </div>
                        </div>
                    </div>
                ) : null}
            </main>
        </div>
    );
}

