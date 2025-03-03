import { MessageType } from '@root/models/AppModels';
import { ApiPaths } from '../constants';
import axiosInstance from './AxiosInstance';

function normalRandom(mean: number, stdDev: number): number {
    // Generate a random number from a standard normal distribution using Box-Muller transform
    let u = 1 - Math.random(); // Converting [0,1) to (0,1]
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + stdDev * z; // Scale and shift
}

function gammaRandom(shape: number, scale: number): number {
    // Approximate Gamma distribution using Marsaglia and Tsang's method
    if (shape < 1) {
        shape += 1;
    }
    let d = shape - 1 / 3;
    let c = 1 / Math.sqrt(9 * d);
    let x, v;
    do {
        let u = Math.random();
        let n = normalRandom(0, 1);
        v = Math.pow(1 + c * n, 3);
        if (v > 0 && Math.log(u) < 0.5 * n * n + d * (1 - v + Math.log(v))) {
            x = d * v;
            break;
        }
    } while (true);
    return x * scale;
}

function getResponseDelay(n_char: number, n_char_prev: number): number {
    let delay = (normalRandom(0.3, 0.03) * n_char 
        + gammaRandom(2.5, 0.25)
        + normalRandom(0.03, 0.003) * n_char_prev); 
    
    return delay; // Time delay in seconds
}

const serialize = (obj) =>
    Object.keys(obj)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
        .join('&');

export const sendMessage = async (message: MessageType, conversationId: string): Promise<MessageType> => {
    try {
        const response = await axiosInstance.post(`/${ApiPaths.CONVERSATIONS_PATH}/message`, {
            message,
            conversationId,
        });
	console.log(response.data.content)
        if(response.data.content && response.data.timeDelay != null && response.data.timeDelay != 0) {
            const num_word = response.data.content.trim().split(/\s+/).length;
            console.log(num_word)
            await new Promise(resolve => setTimeout(resolve, (num_word / response.data.timeDelay) * 1000));
        }
        if(response.data.content && response.data.timeDelay == 0) {
            const num_char = response.data.content.length;
            const prev_num_char = response.data.prev_message.length;
            const delay = getResponseDelay(num_char, prev_num_char)
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const sendStreamMessage = (
    message: MessageType,
    conversationId: string,
    onMessageReceived: (message: string) => void,
    onCloseStream: (message: MessageType) => void,
    onError: (error?: Event | { code: number; message: string }) => void,
) => {
    const eventSource = new EventSource(
        `${process.env.REACT_APP_API_URL}/${ApiPaths.CONVERSATIONS_PATH}/message/stream?${serialize(
            message,
        )}&conversationId=${conversationId}`,
    );

    eventSource.addEventListener('close', (event) => {
        console.log('Server is closing the connection.');
        const message = JSON.parse(event.data);
	console.log(message, "1")
        onCloseStream(message);
        eventSource.close();
    });

    eventSource.onmessage = (event) => {
        if (!event.data.trim()) {
            return;
        }

        const data = JSON.parse(event.data);
	console.log(data, "2")

        if (data.error) {
            if (onError) {
                onError(data.error);
            }
            eventSource.close();
            return;
        }

        onMessageReceived(data.message);
    };

    eventSource.onerror = (error) => {
        if (eventSource.readyState === EventSource.CLOSED) {
            console.log('Connection was closed normally.');
        } else if (onError) {
            onError(error);
        }
        eventSource.close();
    };
};

export const createConversation = async (
    userId: string,
    numberOfConversations: number,
    experimentId: string,
): Promise<string> => {
    try {
        const response = await axiosInstance.post(`/${ApiPaths.CONVERSATIONS_PATH}/create`, {
            userId,
            numberOfConversations,
            experimentId,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getConversation = async (conversationId: string): Promise<MessageType[]> => {
    try {
        const response = await axiosInstance.get(
            `/${ApiPaths.CONVERSATIONS_PATH}/conversation?conversationId=${conversationId}`,
        );
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateConversationMetadata = async (
    conversationId: string,
    data: object,
    isPreConversation: boolean,
): Promise<void> => {
    try {
        await axiosInstance.put(`/${ApiPaths.CONVERSATIONS_PATH}/metadata`, {
            conversationId,
            data,
            isPreConversation,
        });
        return;
    } catch (error) {
        throw error;
    }
};

export const finishConversation = async (
    conversationId: string,
    experimentId: string,
    isAdmin: boolean,
): Promise<void> => {
    try {
        await axiosInstance.post(`/${ApiPaths.CONVERSATIONS_PATH}/finish`, {
            conversationId,
            experimentId,
            isAdmin,
        });
        return;
    } catch (error) {
        throw error;
    }
};

export const updateUserAnnotation = async (messageId: string, userAnnotation: number): Promise<void> => {
    try {
        await axiosInstance.put(`/${ApiPaths.CONVERSATIONS_PATH}/annotation`, {
            messageId,
            userAnnotation,
        });
        return;
    } catch (error) {
        throw error;
    }
};
