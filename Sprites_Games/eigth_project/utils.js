export function drawStatusText(context, input,player){
    context.font = '24px Helvetica'
    context.fillText('Last input: '+ input.lastKey, 20, 50);
    context.fillText('Last input: '+ player.currentState.state, 20, 90);
    
}